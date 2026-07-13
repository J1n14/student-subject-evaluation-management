let evalStudents = [];
let subjectsCatalogCache = null;
let currentSelectedStudentId = null;
let creditTabState = null; // { student, requiredSubjects, requiredSubjectsById, creditedMap }

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
          <div id="credit-evaluation-panel">
            <div class="text-muted text-center py-5">
              <i class="bi bi-arrow-left-circle" style="font-size:2rem;"></i>
              <p class="mt-2">Select a student to view their credit evaluation.</p>
            </div>
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
                    <div class="row">
                      <div class="col-6 mb-3">
                        <label class="form-label">Grade</label>
                        <input type="text" class="form-control" id="creditGrade" required />
                        <div class="invalid-feedback">Required.</div>
                      </div>
                      <div class="col-6 mb-3">
                        <label class="form-label">Remarks</label>
                        <input type="text" class="form-control" id="creditRemarks" placeholder="Optional" />
                      </div>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" class="btn btn-primary" id="credit-save-btn">Save</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("eval-student-search").addEventListener("input", debounce(renderEvalStudentList, 200));
  document.getElementById("credit-form").addEventListener("submit", saveCreditedSubject);

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
      (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="selectStudentForCreditEvaluation('${s.id}')">
        <div class="d-flex justify-content-between">
          <span>${escapeHtml(s.fullName)}</span>
          ${statusBadge(s.status || "Pending")}
        </div>
        <div class="small text-muted">${escapeHtml(s.id)} &middot; ${escapeHtml(s.track)}</div>
      </button>`
    )
    .join("") || `<div class="text-muted small p-2">No students found.</div>`;
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

  const requiredSubjects = getRequiredSubjects(student, allSubjectsArr);
  const requiredSubjectsById = Object.fromEntries(requiredSubjects.map((s) => [s.id, s]));
  const creditedMap = buildCreditedMap(creditedDocs);
  const progress = computeCreditProgress(requiredSubjects, creditedMap);

  creditTabState = { student, requiredSubjects, requiredSubjectsById, creditedMap };

  renderCreditEvaluationTab(student, requiredSubjects, creditedMap, progress);
}

function renderCreditEvaluationTab(student, requiredSubjects, creditedMap, progress) {
  const panel = document.getElementById("credit-evaluation-panel");

  const creditedRows = requiredSubjects.filter((s) => creditedMap.has(s.id));
  const stillToTakeRows = requiredSubjects
    .filter((s) => !creditedMap.has(s.id))
    .sort((a, b) => {
      const yearDiff = YEAR_ORDER.indexOf(a.yearLevel) - YEAR_ORDER.indexOf(b.yearLevel);
      if (yearDiff !== 0) return yearDiff;
      if (a.semester !== b.semester) return (a.semester || "").localeCompare(b.semester || "");
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });

  const emptyPoolNotice =
    requiredSubjects.length === 0
      ? `<div class="alert alert-warning">No catalog subjects found yet for this student's <strong>${escapeOrDash(student.curriculum)} curriculum</strong> / <strong>${escapeOrDash(student.track)} track</strong>. Add matching subjects in the Subjects panel first.</div>`
      : "";

  panel.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-3">
      <div>
        <h5 class="mb-0">${escapeHtml(student.fullName)}</h5>
      </div>
      ${statusBadge(student.status || "Pending")}
    </div>

    ${emptyPoolNotice}

    <div class="row g-3 align-items-center mb-4">
      <div class="col-auto">${renderProgressRingSvg(progress.overallPercent)}</div>
      <div class="col">
        <div class="small text-uppercase text-muted fw-semibold mb-2">Progress by Year Level</div>
        ${YEAR_ORDER.map((y) => {
          const { creditedUnits, requiredUnits } = progress.perYear[y];
          const pct = requiredUnits > 0 ? Math.round((creditedUnits / requiredUnits) * 100) : 0;
          return `
          <div class="mb-2">
            <div class="d-flex justify-content-between small mb-1">
              <span>${y}</span>
              <span class="text-muted">${creditedUnits}/${requiredUnits} u</span>
            </div>
            <div class="progress" style="height:8px;">
              <div class="progress-bar" role="progressbar" style="width:${pct}%"></div>
            </div>
          </div>`;
        }).join("")}
      </div>
      <div class="col-auto text-center">
        <div class="d-flex gap-4">
          <div><div class="fw-bold fs-5">${progress.totalCreditedUnits}</div><div class="small text-muted">credited units</div></div>
          <div><div class="fw-bold fs-5">${progress.remainingUnits}</div><div class="small text-muted">remaining units</div></div>
        </div>
        <div class="progress mt-2" style="height:6px; width:180px;">
          <div class="progress-bar bg-success" style="width:${progress.overallPercent}%"></div>
          <div class="progress-bar bg-light border" style="width:${100 - progress.overallPercent}%"></div>
        </div>
        <div class="d-flex gap-3 small mt-1 text-muted justify-content-center">
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#198754;" class="me-1"></span>credited</span>
          <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#e9ecef;border:1px solid #adb5bd;" class="me-1"></span>remaining</span>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="mb-0">Credited Subjects</h6>
      <button class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#creditModal" onclick="openCreditModal()">
        <i class="bi bi-plus-lg me-1"></i>Add Credited Subject
      </button>
    </div>
    <div class="table-responsive mb-4">
      <table class="table table-sm">
        <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Credited From (transcript)</th><th>Grade</th><th>Remarks</th><th class="text-end">Actions</th></tr></thead>
        <tbody>
          ${
            creditedRows.length
              ? creditedRows
                  .map((s) => {
                    const record = creditedMap.get(s.id);
                    return `
                <tr>
                  <td class="text-nowrap">${escapeHtml(s.subjectCode)}</td>
                  <td>${escapeHtml(s.subjectName)}</td>
                  <td>${escapeHtml(s.units)}</td>
                  <td>${escapeHtml(record.creditedFrom)}</td>
                  <td>${escapeHtml(record.grade)}</td>
                  <td>${escapeOrDash(record.remarks)}</td>
                  <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary" onclick="openCreditModal('${record.id}')" data-bs-toggle="modal" data-bs-target="#creditModal"><i class="bi bi-pencil"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteCreditedSubject('${record.id}', '${student.id}')"><i class="bi bi-trash"></i></button>
                  </td>
                </tr>`;
                  })
                  .join("")
              : `<tr><td colspan="7" class="text-center text-muted py-3">No credited subjects yet.</td></tr>`
          }
        </tbody>
      </table>
    </div>

    <h6 class="mb-2">Subjects Still To Take (full path to graduation)</h6>
    <div class="table-responsive">
      <table class="table table-sm">
        <thead><tr><th>Year</th><th>Semester</th><th>Code</th><th>Subject</th><th>Units</th><th>Prerequisite</th><th>Why not credited</th></tr></thead>
        <tbody>
          ${
            stillToTakeRows.length
              ? stillToTakeRows
                  .map(
                    (s) => `
              <tr>
                <td class="text-nowrap">${escapeHtml(s.yearLevel)}</td>
                <td class="text-nowrap">${escapeHtml(s.semester)}</td>
                <td class="text-nowrap">${escapeHtml(s.subjectCode)}</td>
                <td>${escapeHtml(s.subjectName)}</td>
                <td>${escapeHtml(s.units)}</td>
                <td class="text-nowrap">${escapeOrDash(s.prerequisite)}</td>
                <td class="small">${getNotCreditedReason(s, creditedMap, creditTabState.requiredSubjectsById)}</td>
              </tr>`
                  )
                  .join("")
              : `<tr><td colspan="7" class="text-center text-muted py-3">${requiredSubjects.length ? "All required subjects are credited." : "No required subjects to display yet."}</td></tr>`
          }
        </tbody>
      </table>
    </div>`;
}

function openCreditModal(creditId) {
  const form = document.getElementById("credit-form");
  form.classList.remove("was-validated");
  form.reset();
  document.getElementById("creditDocId").value = "";
  document.getElementById("creditModalTitle").textContent = "Add Credited Subject";

  const { requiredSubjects, creditedMap } = creditTabState;
  const existingRecord = creditId ? [...creditedMap.values()].find((r) => r.id === creditId) : null;

  const eligible = requiredSubjects.filter((s) => !creditedMap.has(s.id) || (existingRecord && s.id === existingRecord.subjectId));

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
    document.getElementById("creditGrade").value = existingRecord.grade || "";
    document.getElementById("creditRemarks").value = existingRecord.remarks || "";
  } else {
    select.disabled = false;
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
        grade: document.getElementById("creditGrade").value.trim(),
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
    renderEvalStudentList();

    bootstrap.Modal.getInstance(document.getElementById("creditModal")).hide();
    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to save credited subject.");
  } finally {
    btn.disabled = false;
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
    renderEvalStudentList();

    await selectStudentForCreditEvaluation(studentId);
  } catch (err) {
    showError(err, "Failed to remove credited subject.");
  }
}
