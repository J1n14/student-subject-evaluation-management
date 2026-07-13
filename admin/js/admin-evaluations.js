let evalStudents = [];
let evalSubjectsCache = {};
let subjectsCatalogCache = null;
let currentSelectedStudentId = null;
let creditTabState = null; // { student, requiredSubjects, requiredSubjectsById, completedMap }

const YEAR_ORDER = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

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
          <ul class="nav nav-tabs mb-3" id="eval-mode-tabs">
            <li class="nav-item">
              <button class="nav-link active" id="tab-subject-eval" data-bs-toggle="tab" data-bs-target="#pane-subject-eval" type="button">
                <i class="bi bi-clipboard-check me-1"></i>Subject Evaluation
              </button>
            </li>
            <li class="nav-item">
              <button class="nav-link" id="tab-credit-eval" data-bs-toggle="tab" data-bs-target="#pane-credit-eval" type="button">
                <i class="bi bi-award me-1"></i>Credit Evaluation
              </button>
            </li>
          </ul>
          <div class="tab-content">
            <div class="tab-pane fade show active" id="pane-subject-eval">
              <div id="evaluation-panel">
                <div class="text-muted text-center py-5">
                  <i class="bi bi-arrow-left-circle" style="font-size:2rem;"></i>
                  <p class="mt-2">Select a student to evaluate their assigned subjects.</p>
                </div>
              </div>
            </div>
            <div class="tab-pane fade" id="pane-credit-eval">
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
        </div>
      </div>
    </div>`;

  document.getElementById("eval-student-search").addEventListener("input", debounce(renderEvalStudentList, 200));
  document.getElementById("credit-form").addEventListener("submit", saveCreditedSubject);
  document.getElementById("tab-subject-eval").addEventListener("shown.bs.tab", () => {
    if (currentSelectedStudentId) selectStudentForEvaluation(currentSelectedStudentId);
  });
  document.getElementById("tab-credit-eval").addEventListener("shown.bs.tab", () => {
    if (currentSelectedStudentId) selectStudentForCreditEvaluation(currentSelectedStudentId);
  });

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
      (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="selectStudent('${s.id}')">
        <div class="d-flex justify-content-between">
          <span>${escapeHtml(s.fullName)}</span>
          ${statusBadge(s.status || "Pending")}
        </div>
        <div class="small text-muted">${escapeHtml(s.id)} &middot; ${escapeHtml(s.track)}</div>
      </button>`
    )
    .join("") || `<div class="text-muted small p-2">No students found.</div>`;
}

function selectStudent(studentId) {
  currentSelectedStudentId = studentId;
  const creditTabActive = document.getElementById("pane-credit-eval").classList.contains("active");
  if (creditTabActive) {
    selectStudentForCreditEvaluation(studentId);
  } else {
    selectStudentForEvaluation(studentId);
  }
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

// ==================== Credit Evaluation ====================

async function getSubjectsCatalog() {
  if (subjectsCatalogCache) return subjectsCatalogCache;
  const snap = await db.collection("subjects").get();
  subjectsCatalogCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return subjectsCatalogCache;
}

// A subject counts toward a student's plan if it's Active, its curriculum
// matches the student's (missing curriculum on legacy subjects is treated
// as "New"), and its track matches the student's track, is "All Tracks", or
// is unset (legacy subjects created before the Track field existed apply to
// every track).
function getRequiredSubjects(student, allSubjectsArr) {
  const studentCurriculum = student.curriculum || "New";
  return allSubjectsArr.filter((s) => {
    const subjCurriculum = s.curriculum || "New";
    const matchesCurriculum = subjCurriculum === studentCurriculum;
    const matchesTrack = !s.track || s.track === student.track || s.track === "All Tracks";
    const isActive = (s.status || "Active") === "Active";
    return matchesCurriculum && matchesTrack && isActive;
  });
}

// Completed = credited from transcript OR passed via the normal Subject
// Evaluation flow. A manual credit entry takes precedence if both exist.
function getCompletedMap(creditedDocs, evaluationDocs) {
  const map = new Map();
  evaluationDocs
    .filter((e) => e.status === "Passed")
    .forEach((e) => map.set(e.subjectId, { source: "evaluation", record: e }));
  creditedDocs.forEach((c) => map.set(c.subjectId, { source: "credited", record: c }));
  return map;
}

function computeCreditProgress(requiredSubjects, completedMap) {
  const perYear = {};
  YEAR_ORDER.forEach((y) => (perYear[y] = { creditedUnits: 0, requiredUnits: 0 }));

  let totalCreditedUnits = 0;
  let totalRequiredUnits = 0;

  requiredSubjects.forEach((s) => {
    const bucket = perYear[s.yearLevel] || (perYear[s.yearLevel] = { creditedUnits: 0, requiredUnits: 0 });
    const units = Number(s.units) || 0;
    bucket.requiredUnits += units;
    totalRequiredUnits += units;
    if (completedMap.has(s.id)) {
      bucket.creditedUnits += units;
      totalCreditedUnits += units;
    }
  });

  const overallPercent = totalRequiredUnits > 0 ? Math.round((totalCreditedUnits / totalRequiredUnits) * 100) : 0;

  return {
    perYear,
    totalCreditedUnits,
    totalRequiredUnits,
    remainingUnits: Math.max(0, totalRequiredUnits - totalCreditedUnits),
    overallPercent
  };
}

function getNotCreditedReason(subject, completedMap, requiredSubjectsById) {
  const prereqCode = (subject.prerequisite || "").trim();
  if (!prereqCode) return "Not yet credited or passed.";

  const prereqSubject = Object.values(requiredSubjectsById).find((s) => s.subjectCode === prereqCode);

  if (!prereqSubject) {
    return `Not yet credited or passed. (Prerequisite "${escapeHtml(prereqCode)}" not found in curriculum.)`;
  }
  if (!completedMap.has(prereqSubject.id)) {
    return `Requires prerequisite "${escapeHtml(prereqSubject.subjectCode)} - ${escapeHtml(prereqSubject.subjectName)}" to be completed first.`;
  }
  return "Not yet credited or passed.";
}

function renderProgressRingSvg(percent) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return `
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#e9ecef" stroke-width="12" />
      <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#0d6efd" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 70 70)" />
      <text x="70" y="65" text-anchor="middle" font-size="24" font-weight="700">${percent}%</text>
      <text x="70" y="86" text-anchor="middle" font-size="11" fill="#6c757d">of units</text>
    </svg>`;
}

async function selectStudentForCreditEvaluation(studentId) {
  const student = evalStudents.find((s) => s.id === studentId);
  const panel = document.getElementById("credit-evaluation-panel");
  panel.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const [allSubjectsArr, creditedSnap, evalSnap] = await Promise.all([
    getSubjectsCatalog(),
    db.collection("creditedSubjects").where("studentId", "==", studentId).get(),
    db.collection("evaluations").where("studentId", "==", studentId).get()
  ]);

  const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const evaluationDocs = evalSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const requiredSubjects = getRequiredSubjects(student, allSubjectsArr);
  const requiredSubjectsById = Object.fromEntries(requiredSubjects.map((s) => [s.id, s]));
  const completedMap = getCompletedMap(creditedDocs, evaluationDocs);
  const progress = computeCreditProgress(requiredSubjects, completedMap);

  creditTabState = { student, requiredSubjects, requiredSubjectsById, completedMap };

  renderCreditEvaluationTab(student, requiredSubjects, completedMap, progress);
}

function renderCreditEvaluationTab(student, requiredSubjects, completedMap, progress) {
  const panel = document.getElementById("credit-evaluation-panel");

  const creditedRows = requiredSubjects.filter((s) => completedMap.has(s.id));
  const stillToTakeRows = requiredSubjects
    .filter((s) => !completedMap.has(s.id))
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
        <div class="text-muted small">
          Student No. ${escapeHtml(student.id)} &middot; ${escapeOrDash(student.curriculum)} curriculum &middot;
          ${escapeOrDash(student.track)} track &middot; Entering ${escapeOrDash(student.yearLevel)} &middot;
          Evaluated ${formatDate(student.updatedAt)}
        </div>
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
                    const entry = completedMap.get(s.id);
                    const isManual = entry.source === "credited";
                    return `
                <tr>
                  <td class="text-nowrap">${escapeHtml(s.subjectCode)}</td>
                  <td>${escapeHtml(s.subjectName)}</td>
                  <td>${escapeHtml(s.units)}</td>
                  <td>${isManual ? escapeHtml(entry.record.creditedFrom) : "-"}</td>
                  <td>${isManual ? escapeHtml(entry.record.grade) : "-"}</td>
                  <td>${isManual ? escapeOrDash(entry.record.remarks) : `<span class="text-muted small">Passed via Subject Evaluation</span>`}</td>
                  <td class="text-end">
                    ${
                      isManual
                        ? `<button class="btn btn-sm btn-outline-primary" onclick="openCreditModal('${entry.record.id}')" data-bs-toggle="modal" data-bs-target="#creditModal"><i class="bi bi-pencil"></i></button>
                           <button class="btn btn-sm btn-outline-danger" onclick="deleteCreditedSubject('${entry.record.id}', '${student.id}')"><i class="bi bi-trash"></i></button>`
                        : ""
                    }
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
        <thead><tr><th>Year</th><th>Semester</th><th>Code</th><th>Subject</th><th>Units</th><th>Why not credited</th></tr></thead>
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
                <td class="small">${getNotCreditedReason(s, completedMap, creditTabState.requiredSubjectsById)}</td>
              </tr>`
                  )
                  .join("")
              : `<tr><td colspan="6" class="text-center text-muted py-3">${requiredSubjects.length ? "All required subjects are credited or passed." : "No required subjects to display yet."}</td></tr>`
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

  const { requiredSubjects, completedMap } = creditTabState;
  const existing = creditId
    ? [...completedMap.values()].find((e) => e.source === "credited" && e.record.id === creditId)?.record
    : null;

  // Eligible subjects = required subjects not yet completed, plus the subject
  // currently being edited (so its own entry doesn't disappear from the list).
  const eligible = requiredSubjects.filter((s) => !completedMap.has(s.id) || (existing && s.id === existing.subjectId));

  const select = document.getElementById("creditSubjectId");
  if (eligible.length === 0) {
    select.innerHTML = `<option value="" disabled selected>No eligible subjects — add matching subjects first</option>`;
  } else {
    select.innerHTML =
      `<option value="">Select subject</option>` +
      eligible.map((s) => `<option value="${s.id}">${escapeHtml(s.subjectCode)} - ${escapeHtml(s.subjectName)}</option>`).join("");
  }

  if (existing) {
    document.getElementById("creditModalTitle").textContent = "Edit Credited Subject";
    document.getElementById("creditDocId").value = existing.id;
    select.value = existing.subjectId;
    select.disabled = true;
    document.getElementById("creditedFrom").value = existing.creditedFrom || "";
    document.getElementById("creditGrade").value = existing.grade || "";
    document.getElementById("creditRemarks").value = existing.remarks || "";
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
    showToast("Credited subject saved.");

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
    showToast("Credited subject removed.");
    await selectStudentForCreditEvaluation(studentId);
  } catch (err) {
    showError(err, "Failed to remove credited subject.");
  }
}
