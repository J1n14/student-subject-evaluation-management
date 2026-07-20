let allExceptions = [];

async function initAdminCourseMatches(content) {
  content.innerHTML = `
    <div class="section-card">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h6 class="mb-1"><i class="bi bi-shuffle me-1"></i>Curriculum Course Matches</h6>
          <div class="text-muted small">
            Subjects whose code matches between the Old and New curricula but whose name differs.
            Review each one and decide whether it's really the same course carried over, or a
            genuinely different subject that happens to reuse the code.
          </div>
        </div>
        <select class="form-select" style="width:160px" id="filter-status">
          <option value="pending">Pending review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>
      <div id="matches-list"></div>
    </div>`;

  document.getElementById("filter-status").addEventListener("change", renderMatchesList);
  await loadExceptions();
}

async function loadExceptions() {
  const snap = await db.collection("courseMatchExceptions").orderBy("detectedAt", "desc").get();
  allExceptions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderMatchesList();
}

function renderMatchesList() {
  const statusFilter = document.getElementById("filter-status").value;
  const filtered = statusFilter ? allExceptions.filter((e) => e.status === statusFilter) : allExceptions;
  const list = document.getElementById("matches-list");

  if (filtered.length === 0) {
    list.innerHTML = `<div class="text-center text-muted py-4">No ${statusFilter || ""} course matches to show.</div>`;
    return;
  }

  list.innerHTML = `
    <div class="table-responsive">
      <table class="table table-hover align-middle">
        <thead>
          <tr>
            <th>Old Curriculum</th>
            <th>New Curriculum</th>
            <th>Status</th>
            <th class="text-end">Action</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map(
              (e) => `
            <tr>
              <td>
                <div class="subj-code-cell">${escapeHtml(e.oldCode)}</div>
                <div class="small text-muted">${escapeHtml(e.oldName)}</div>
              </td>
              <td>
                <div class="subj-code-cell">${escapeHtml(e.newCode)}</div>
                <div class="small text-muted">${escapeHtml(e.newName)}</div>
              </td>
              <td>${matchStatusBadge(e.status)}</td>
              <td class="text-end">
                ${
                  e.status === "pending"
                    ? `
                  <button class="btn btn-sm btn-outline-success me-1" onclick="decideMatch('${e.id}','accepted')">
                    <i class="bi bi-check-lg me-1"></i>Accept
                  </button>
                  <button class="btn btn-sm btn-outline-danger" onclick="decideMatch('${e.id}','rejected')">
                    <i class="bi bi-x-lg me-1"></i>Reject
                  </button>`
                    : `<button class="btn btn-sm btn-outline-secondary" onclick="decideMatch('${e.id}','pending')">
                    <i class="bi bi-arrow-counterclockwise me-1"></i>Reopen
                  </button>`
                }
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function matchStatusBadge(status) {
  const map = { pending: "bg-warning text-dark", accepted: "bg-success", rejected: "bg-secondary" };
  return `<span class="badge ${map[status] || "bg-secondary"}">${escapeHtml(status)}</span>`;
}

// "Accepted" means the admin confirms it's the same course carried over
// between curricula, even though the names differ. This decision is read
// live by the Evaluations page (getCourseEquivalence() in
// admin-evaluations.js) when an admin credits a subject whose code
// overlaps with the other curriculum: an accepted match relaxes nothing
// structurally (Credited From stays required, since it may genuinely be
// from elsewhere) but surfaces the accepted equivalence as a hint so the
// admin knows it's already been reviewed. "Rejected" surfaces the opposite
// note - treat the code overlap as coincidental.
async function decideMatch(exceptionId, status) {
  try {
    await db.collection("courseMatchExceptions").doc(exceptionId).update({
      status,
      reviewedBy: auth.currentUser.email,
      reviewedAt: serverTimestamp()
    });
    await logActivity(`Course match ${exceptionId} marked ${status}`);
    showToast(`Marked as ${status}.`);
    await loadExceptions();
  } catch (err) {
    showError(err, "Failed to update course match.");
  }
}