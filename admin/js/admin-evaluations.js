let evalStudents = [];
let evalSubjectsCache = {};

async function initAdminEvaluations(content) {
  content.innerHTML = `
    <div class="row g-3">
      <div class="col-lg-4">
        <div class="section-card">
          <h6 class="mb-3"><i class="bi bi-person-check me-1"></i>Select Student</h6>
          <input type="text" class="form-control mb-2" placeholder="Search student..." id="eval-student-search" />
          <div class="list-group" id="eval-student-list" style="max-height:520px; overflow-y:auto;"></div>
        </div>
      </div>
      <div class="col-lg-8">
        <div class="section-card">
          <div id="evaluation-panel">
            <div class="text-muted text-center py-5">
              <i class="bi bi-arrow-left-circle" style="font-size:2rem;"></i>
              <p class="mt-2">Select a student to evaluate their assigned subjects.</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("eval-student-search").addEventListener("input", debounce(renderEvalStudentList, 200));

  const snap = await db.collection("students").orderBy("fullName").get();
  evalStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderEvalStudentList();
}

function renderEvalStudentList() {
  const search = document.getElementById("eval-student-search").value.toLowerCase();
  const filtered = evalStudents.filter(
    (s) => !search || s.fullName.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)
  );
  document.getElementById("eval-student-list").innerHTML = filtered
    .map(
      (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="selectStudentForEvaluation('${s.id}')">
        <div class="d-flex justify-content-between">
          <span>${escapeHtml(s.fullName)}</span>
          ${statusBadge(s.status || "Pending")}
        </div>
        <div class="small text-muted">${escapeHtml(s.id)} &middot; ${escapeHtml(s.track)}</div>
      </button>`
    )
    .join("") || `<div class="text-muted small p-2">No students found.</div>`;
}

async function selectStudentForEvaluation(studentId) {
  const student = evalStudents.find((s) => s.id === studentId);
  const panel = document.getElementById("evaluation-panel");
  panel.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const [assignSnap, evalSnap] = await Promise.all([
    db.collection("studentSubjects").where("studentId", "==", studentId).get(),
    db.collection("evaluations").where("studentId", "==", studentId).get()
  ]);

  if (assignSnap.empty) {
    panel.innerHTML = `
      <h5>${escapeHtml(student.fullName)}</h5>
      <div class="alert alert-warning mt-3">This student has no assigned subjects yet. Go to <strong>Subject Assignment</strong> first.</div>`;
    return;
  }

  const subjectIds = assignSnap.docs.map((d) => d.data().subjectId);
  const subjectDocs = await Promise.all(subjectIds.map((id) => getCachedSubject(id)));
  const evalMap = {};
  evalSnap.forEach((d) => (evalMap[d.data().subjectId] = { id: d.id, ...d.data() }));

  panel.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-3">
      <div>
        <h5 class="mb-0">${escapeHtml(student.fullName)}</h5>
        <div class="text-muted small">${escapeHtml(student.id)} &middot; ${escapeHtml(student.track)} &middot; ${escapeHtml(student.yearLevel)}</div>
      </div>
      ${statusBadge(student.status || "Pending")}
    </div>
    <form id="evaluation-form">
      ${subjectDocs
        .map((sub, i) => {
          const subjectId = subjectIds[i];
          const existing = evalMap[subjectId];
          return `
        <div class="border rounded p-3 mb-2">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <strong>${escapeHtml(sub.subjectCode)} - ${escapeHtml(sub.subjectName)}</strong>
            <span class="text-muted small">${sub.units} units &middot; ${escapeHtml(sub.semester)}</span>
          </div>
          <div class="row g-2">
            <div class="col-md-4">
              <select class="form-select form-select-sm eval-status" data-subject="${subjectId}">
                <option value="">Not evaluated</option>
                <option value="Passed" ${existing?.status === "Passed" ? "selected" : ""}>Passed</option>
                <option value="Failed" ${existing?.status === "Failed" ? "selected" : ""}>Failed</option>
                <option value="Incomplete" ${existing?.status === "Incomplete" ? "selected" : ""}>Incomplete</option>
              </select>
            </div>
            <div class="col-md-8">
              <input type="text" class="form-control form-control-sm eval-remarks" data-subject="${subjectId}"
                placeholder="Remarks (optional)" value="${escapeHtml(existing?.remarks || "")}" />
            </div>
          </div>
          ${existing ? `<div class="small text-muted mt-1">Last evaluated: ${formatDateTime(existing.evaluatedAt)}</div>` : ""}
        </div>`;
        })
        .join("")}
      <button type="submit" class="btn btn-primary mt-2"><i class="bi bi-save me-1"></i>Save Evaluation</button>
    </form>`;

  document.getElementById("evaluation-form").addEventListener("submit", (e) => saveEvaluations(e, studentId, subjectIds, evalMap));
}

async function getCachedSubject(id) {
  if (evalSubjectsCache[id]) return evalSubjectsCache[id];
  const doc = await db.collection("subjects").doc(id).get();
  const data = doc.exists ? { id: doc.id, ...doc.data() } : { id, subjectCode: "?", subjectName: "Unknown subject", units: "-", semester: "-" };
  evalSubjectsCache[id] = data;
  return data;
}

async function saveEvaluations(e, studentId, subjectIds, evalMap) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    const batch = db.batch();
    let savedCount = 0;

    subjectIds.forEach((subjectId) => {
      const statusEl = document.querySelector(`.eval-status[data-subject="${subjectId}"]`);
      const remarksEl = document.querySelector(`.eval-remarks[data-subject="${subjectId}"]`);
      const status = statusEl.value;
      if (!status) return; // skip subjects left unevaluated this round

      // Deterministic doc ID prevents duplicate evaluations for the same student+subject.
      const docId = `${studentId}_${subjectId}`;
      const ref = db.collection("evaluations").doc(docId);
      batch.set(
        ref,
        {
          studentId,
          subjectId,
          status,
          remarks: remarksEl.value.trim(),
          evaluatedBy: auth.currentUser.email,
          evaluatedAt: serverTimestamp()
        },
        { merge: true }
      );
      savedCount++;
    });

    if (savedCount === 0) {
      showToast("Select a status for at least one subject.", "warning");
      btn.disabled = false;
      return;
    }

    await batch.commit();
    await logActivity(`Saved evaluations for student ${studentId}`);
    const newStatus = await recomputeStudentStatus(studentId);
    showToast(`Evaluation saved. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === studentId);
    if (idx > -1) evalStudents[idx].status = newStatus;

    await selectStudentForEvaluation(studentId);
  } catch (err) {
    showError(err, "Failed to save evaluation.");
  } finally {
    btn.disabled = false;
  }
}
