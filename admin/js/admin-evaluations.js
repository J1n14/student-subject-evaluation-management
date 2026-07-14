let evalStudents = [];
let subjectsCatalogCache = null;
let currentSelectedStudentId = null;
let creditTabState = null; // { student, requiredSubjects, requiredSubjectsById, creditedMap }

async function initAdminEvaluations(content) {
  content.innerHTML = `
    <div class="section-card mb-3">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-primary rounded-pill me-1">1</span>Select Student</label>
      <div class="position-relative">
        <input type="text" class="form-control" id="eval-student-search" placeholder="Search by name or email..." autocomplete="off" />
        <div class="list-group position-absolute w-100 mt-1" id="eval-student-search-results" style="display:none;"></div>
      </div>
      <div id="eval-selected-student-chip" class="mt-2"></div>
    </div>

    <div class="section-card" id="eval-section" style="display:none">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-primary rounded-pill me-1">2</span>Credit Evaluation</label>
      <div id="credit-evaluation-panel"></div>
    </div>

    <div class="modal fade" id="creditModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="creditModalTitle">Add Credited Subject</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="credit-form" class="needs-validation" novalidate>
            <div class="modal-body">
              <input type="hidden" id="creditDocId" />
              <div class="mb-3">
                <label class="form-label">Subject</label>
                <select class="form-select" id="creditSubjectId" required>
                  <option value="">Select subject</option>
                </select>
                <div class="invalid-feedback">Select a subject.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Credited From (old school course)</label>
                <input type="text" class="form-control" id="creditedFrom" placeholder="e.g. GE 1102 - Mathematics in the Modern World" required />
                <div class="invalid-feedback">Required.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Remarks</label>
                <input type="text" class="form-control" id="creditRemarks" placeholder="Optional" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="credit-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

  document.getElementById("eval-student-search").addEventListener("input", debounce(renderEvalStudentSearchResults, 150));
  document.getElementById("eval-student-search").addEventListener("focus", renderEvalStudentSearchResults);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#eval-student-search") && !e.target.closest("#eval-student-search-results")) {
      const results = document.getElementById("eval-student-search-results");
      if (results) results.style.display = "none";
    }
  });
  document.getElementById("credit-form").addEventListener("submit", saveCreditedSubject);

  const snap = await db.collection("students").orderBy("fullName").get();
  evalStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderEvalStudentSearchResults() {
  const input = document.getElementById("eval-student-search");
  const search = input.value.toLowerCase().trim();
  const results = document.getElementById("eval-student-search-results");

  const matches = evalStudents
    .filter((s) => !search || s.fullName.toLowerCase().includes(search) || (s.email || "").toLowerCase().includes(search))
    .slice(0, 8);

  results.innerHTML = matches.length
    ? matches
        .map(
          (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="pickStudentForEvaluation('${s.id}')">
        <div class="d-flex justify-content-between">
          <span>${escapeHtml(s.fullName)}</span>
          ${statusBadge(s.status || "Pending")}
        </div>
        <div class="small text-muted">${escapeHtml(s.email)} &middot; ${escapeOrDash(s.track)}</div>
      </button>`
        )
        .join("")
    : `<div class="list-group-item text-muted small">No students found.</div>`;
  results.style.display = "block";
}

function pickStudentForEvaluation(studentId) {
  document.getElementById("eval-student-search-results").style.display = "none";
  document.getElementById("eval-student-search").value = "";

  const s = evalStudents.find((x) => x.id === studentId);
  document.getElementById("eval-selected-student-chip").innerHTML = `
    <div class="selected-student-chip">
      <div>
        <strong>${escapeHtml(s.fullName)}</strong>
        <span class="text-muted small ms-2">${escapeHtml(s.email)}</span>
        <span class="ms-2">${statusBadge(s.status || "Pending")}</span>
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearSelectedEvaluationStudent()">
        <i class="bi bi-arrow-repeat me-1"></i>Change student
      </button>
    </div>`;

  document.getElementById("eval-section").style.display = "block";
  selectStudentForCreditEvaluation(studentId);
}

function clearSelectedEvaluationStudent() {
  currentSelectedStudentId = null;
  creditTabState = null;
  document.getElementById("eval-selected-student-chip").innerHTML = "";
  document.getElementById("eval-section").style.display = "none";
  document.getElementById("credit-evaluation-panel").innerHTML = "";
  const input = document.getElementById("eval-student-search");
  input.value = "";
  input.focus();
}

// ==================== Credit Evaluation ====================

async function getSubjectsCatalog() {
  if (subjectsCatalogCache) return subjectsCatalogCache;
  const snap = await db.collection("subjects").get();
  subjectsCatalogCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return subjectsCatalogCache;
}

async function selectStudentForCreditEvaluation(studentId) {
  currentSelectedStudentId = studentId;
  const student = evalStudents.find((s) => s.id === studentId);
  const panel = document.getElementById("credit-evaluation-panel");
  panel.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const [allSubjectsArr, creditedSnap] = await Promise.all([
    getSubjectsCatalog(),
    db.collection("creditedSubjects").where("studentId", "==", studentId).get()
  ]);

  const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const model = buildEvalModel(student, allSubjectsArr, creditedDocs);

  creditTabState = {
    student,
    requiredSubjects: model.required,
    requiredSubjectsById: model.requiredById,
    creditedMap: model.creditedMap
  };

  renderCreditEvaluation(panel, { student, model, interactive: true });
}

// creditId: edit an existing record. preselectSubjectId: pre-choose a subject
// (used by the "Mark credited" buttons in the grouped view).
function openCreditModal(creditId, preselectSubjectId) {
  const form = document.getElementById("credit-form");
  form.classList.remove("was-validated");
  form.reset();
  document.getElementById("creditDocId").value = "";
  document.getElementById("creditModalTitle").textContent = "Add Credited Subject";

  const { requiredSubjects, creditedMap } = creditTabState;
  const existingRecord = creditId ? [...creditedMap.values()].find((r) => r.id === creditId) : null;

  const eligible = requiredSubjects.filter(
    (s) => !creditedMap.has(s.id) || (existingRecord && s.id === existingRecord.subjectId)
  );

  const select = document.getElementById("creditSubjectId");
  if (eligible.length === 0) {
    select.innerHTML = `<option value="" disabled selected>No eligible subjects — add matching subjects first</option>`;
  } else {
    select.innerHTML =
      `<option value="">Select subject</option>` +
      eligible.map((s) => `<option value="${s.id}">${escapeHtml(s.subjectCode)} - ${escapeHtml(s.subjectName)}</option>`).join("");
  }

  if (existingRecord) {
    document.getElementById("creditModalTitle").textContent = "Edit Credited Subject";
    document.getElementById("creditDocId").value = existingRecord.id;
    select.value = existingRecord.subjectId;
    select.disabled = true;
    document.getElementById("creditedFrom").value = existingRecord.creditedFrom || "";
    document.getElementById("creditRemarks").value = existingRecord.remarks || "";
  } else {
    select.disabled = false;
    if (preselectSubjectId) select.value = preselectSubjectId;
  }
}

async function saveCreditedSubject(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const { student } = creditTabState;
  const subjectId = document.getElementById("creditSubjectId").value;
  const btn = document.getElementById("credit-save-btn");
  btn.disabled = true;

  try {
    const docId = `${student.id}_${subjectId}`;
    await db.collection("creditedSubjects").doc(docId).set(
      {
        studentId: student.id,
        subjectId,
        creditedFrom: document.getElementById("creditedFrom").value.trim(),
        remarks: document.getElementById("creditRemarks").value.trim(),
        creditedBy: auth.currentUser.email,
        creditedAt: serverTimestamp()
      },
      { merge: true }
    );

    await logActivity(`Saved credited subject for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Credited subject saved. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    bootstrap.Modal.getInstance(document.getElementById("creditModal")).hide();
    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to save credited subject.");
  } finally {
    btn.disabled = false;
  }
}

// Bulk-credits every required subject the selected student hasn't been
// credited for yet, in one batched write. Useful for quickly clearing an
// old-curriculum carryover instead of clicking "Mark credited" one by one.
// Each record still gets its own deterministic ID (studentId_subjectId), so
// it's safe to run again later - already-credited subjects are skipped.
async function markAllCredited() {
  if (!creditTabState) return;
  const { student, requiredSubjects, creditedMap } = creditTabState;
  const remaining = requiredSubjects.filter((s) => !creditedMap.has(s.id));

  if (remaining.length === 0) {
    showToast("Nothing left to credit for this student.", "info");
    return;
  }

  if (!confirm(`Mark all ${remaining.length} remaining subject(s) as credited for ${student.fullName}? This can be undone individually afterward if needed.`)) {
    return;
  }

  const rawInput = prompt('"Credited From" note to apply to all of them (e.g. old school / bulk carryover):', "Bulk credited by admin");
  if (rawInput === null) return; // admin cancelled
  const creditedFrom = rawInput.trim();

  try {
    const batch = db.batch();
    remaining.forEach((sub) => {
      const ref = db.collection("creditedSubjects").doc(`${student.id}_${sub.id}`);
      batch.set(
        ref,
        {
          studentId: student.id,
          subjectId: sub.id,
          creditedFrom: creditedFrom || "Bulk credited by admin",
          remarks: "Marked via Mark All Credited",
          creditedBy: auth.currentUser.email,
          creditedAt: serverTimestamp()
        },
        { merge: true }
      );
    });
    await batch.commit();

    await logActivity(`Bulk-credited ${remaining.length} subject(s) for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Marked ${remaining.length} subject(s) as credited. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to bulk-credit subjects.");
  }
}

async function deleteCreditedSubject(creditId, studentId) {
  if (!confirm("Remove this credited subject?")) return;
  try {
    await db.collection("creditedSubjects").doc(creditId).delete();
    await logActivity(`Removed credited subject for student ${studentId}`);
    const newStatus = await recomputeCreditStatus(studentId);
    showToast(`Credited subject removed. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === studentId);
    if (idx > -1) evalStudents[idx].status = newStatus;

    await selectStudentForCreditEvaluation(studentId);
  } catch (err) {
    showError(err, "Failed to remove credited subject.");
  }
}
