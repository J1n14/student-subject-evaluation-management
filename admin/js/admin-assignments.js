let assignStudents = [];
let assignSubjects = []; // full subject catalog (needed for curriculum/track matching + prereq lookup)
let currentAssignments = []; // studentSubjects docs for the selected student
let currentCreditedMap = new Map(); // subjectId -> credited record for the selected student
let currentAssignStudent = null; // the currently selected student (used by the Transfer Credit modal)

const SEMESTER_ORDER = ["1st Semester", "2nd Semester", "Midterm", "Summer"];

// Sort helper: year, then semester, then subject code.
function sortByPlan(a, b) {
  const yearDiff = YEAR_ORDER.indexOf(a.yearLevel) - YEAR_ORDER.indexOf(b.yearLevel);
  if (yearDiff !== 0) return yearDiff;
  const semDiff = SEMESTER_ORDER.indexOf(a.semester) - SEMESTER_ORDER.indexOf(b.semester);
  if (semDiff !== 0) return semDiff;
  return (a.subjectCode || "").localeCompare(b.subjectCode || "");
}

// Returns a comma-separated list of prerequisite codes that are NOT yet
// credited for this student (empty string if all prerequisites are met).
function unmetPrerequisites(subject, creditedMap) {
  const text = (subject.prerequisite || "").trim();
  if (!text) return "";
  const codes = text.split(",").map((c) => c.trim()).filter(Boolean);
  const missing = [];
  for (const code of codes) {
    const pre = assignSubjects.find((s) => s.subjectCode === code);
    if (!pre || !creditedMap.has(pre.id)) missing.push(code);
  }
  return missing.join(", ");
}

async function initAdminAssignments(content) {
  content.innerHTML = `
    <div class="row g-3">
      <div class="col-lg-4">
        <div class="section-card">
          <h6 class="mb-3"><i class="bi bi-person-check me-1"></i>Select Student</h6>
          <input type="text" class="form-control mb-2" placeholder="Search student..." id="student-search" />
          <div class="list-group" id="student-list" style="max-height:520px; overflow-y:auto;"></div>
        </div>
      </div>
      <div class="col-lg-8">
        <div class="section-card">
          <div id="assignment-panel">
            <div class="text-muted text-center py-5">
              <i class="bi bi-arrow-left-circle" style="font-size:2rem;"></i>
              <p class="mt-2">Select a student to manage subject assignments.</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById("student-search").addEventListener("input", debounce(renderStudentList, 200));

  // Load the FULL subject catalog (not just the current year, and not just
  // "Active") so we can match by curriculum + track and resolve prerequisites.
  const [studentsSnap, subjectsSnap] = await Promise.all([
    db.collection("students").orderBy("fullName").get(),
    db.collection("subjects").get()
  ]);
  assignStudents = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  assignSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderStudentList();
}

function renderStudentList() {
  const search = document.getElementById("student-search").value.toLowerCase();
  const filtered = assignStudents.filter(
    (s) => !search || s.fullName.toLowerCase().includes(search) || s.id.toLowerCase().includes(search)
  );
  document.getElementById("student-list").innerHTML = filtered
    .map(
      (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="selectStudentForAssignment('${s.id}')">
        <div class="d-flex justify-content-between">
          <span>${escapeHtml(s.fullName)}</span>
          ${statusBadge(s.status || "Pending")}
        </div>
        <div class="small text-muted">${escapeHtml(s.id)} &middot; ${escapeHtml(s.track)}</div>
      </button>`
    )
    .join("") || `<div class="text-muted small p-2">No students found.</div>`;
}

async function selectStudentForAssignment(studentId) {
  const student = assignStudents.find((s) => s.id === studentId);
  currentAssignStudent = student;
  const panel = document.getElementById("assignment-panel");
  panel.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const [assignSnap, creditedSnap] = await Promise.all([
    db.collection("studentSubjects").where("studentId", "==", studentId).get(),
    db.collection("creditedSubjects").where("studentId", "==", studentId).get()
  ]);
  currentAssignments = assignSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  currentCreditedMap = buildCreditedMap(creditedSnap.docs.map((d) => d.data()));

  const assignedIds = new Set(currentAssignments.map((a) => a.subjectId));

  // The student's full plan: every required subject for their curriculum +
  // track, across ALL year levels (this is what lets us assign back-year
  // subjects to transferees / irregular students).
  const requiredSubjects = getRequiredSubjects(student, assignSubjects);
  const requiredIds = new Set(requiredSubjects.map((s) => s.id));

  // Also surface any subject already assigned to this student that falls
  // outside their current plan, so saving never silently drops it.
  const offPlanAssigned = currentAssignments
    .map((a) => assignSubjects.find((s) => s.id === a.subjectId))
    .filter((s) => s && !requiredIds.has(s.id));

  const displaySubjects = [...requiredSubjects, ...offPlanAssigned].sort(sortByPlan);

  const years = [...new Set(displaySubjects.map((s) => s.yearLevel))].sort(
    (a, b) => YEAR_ORDER.indexOf(a) - YEAR_ORDER.indexOf(b)
  );
  const semesters = [...new Set(displaySubjects.map((s) => s.semester))].sort(
    (a, b) => SEMESTER_ORDER.indexOf(a) - SEMESTER_ORDER.indexOf(b)
  );

  const emptyNotice =
    displaySubjects.length === 0
      ? `<div class="alert alert-warning mb-3">No catalog subjects match this student's <strong>${escapeOrDash(student.curriculum)} curriculum</strong> / <strong>${escapeOrDash(student.track)} track</strong> yet. Add matching subjects in the Subjects panel first.</div>`
      : "";

  panel.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-3">
      <div>
        <h5 class="mb-0">${escapeHtml(student.fullName)}</h5>
        <div class="text-muted small">${escapeHtml(student.id)} &middot; ${escapeOrDash(student.curriculum)} &middot; ${escapeHtml(student.track)} &middot; ${escapeHtml(student.yearLevel)}</div>
      </div>
      ${statusBadge(student.status || "Pending")}
    </div>

    ${emptyNotice}

    <form id="assignment-form">
      <label class="form-label">Assign subjects across the student's full curriculum plan</label>
      <div class="d-flex gap-2 mb-2 flex-wrap">
        <input type="text" class="form-control form-control-sm" style="max-width:220px" id="subject-picker-search" placeholder="Filter by code or name..." />
        <select class="form-select form-select-sm" style="max-width:150px" id="subject-picker-year">
          <option value="">All Years</option>
          ${years.map((y) => `<option value="${escapeHtml(y)}"${y === student.yearLevel ? " selected" : ""}>${escapeHtml(y)}</option>`).join("")}
        </select>
        <select class="form-select form-select-sm" style="max-width:160px" id="subject-picker-semester">
          <option value="">All Semesters</option>
          ${semesters.map((sem) => `<option value="${escapeHtml(sem)}">${escapeHtml(sem)}</option>`).join("")}
        </select>
      </div>
      <div class="text-muted small mb-2">
        Showing the current year by default. Choose <strong>All Years</strong> to assign back-year subjects a transferee or irregular student still needs.
      </div>
      <div class="table-responsive border rounded mb-3" style="max-height:430px; overflow-y:auto;">
        <table class="table table-sm table-hover align-middle mb-0" id="subject-picker-table">
          <thead class="sticky-top bg-white"><tr><th></th><th>Year</th><th class="text-nowrap">Semester</th><th>Code</th><th>Subject Name</th><th>Units</th><th class="text-nowrap">Prerequisite</th><th>Status</th></tr></thead>
          <tbody>
            ${
              displaySubjects.length
                ? displaySubjects.map((sub) => renderPickerRow(sub, assignedIds, requiredIds)).join("")
                : `<tr><td colspan="8" class="text-center text-muted py-3">No subjects to display.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button type="submit" class="btn btn-primary"><i class="bi bi-save me-1"></i>Save Assignment</button>
        <button type="button" class="btn btn-outline-success" id="assign-all-btn"><i class="bi bi-check2-all me-1"></i>Assign all still-to-take</button>
        <button type="button" class="btn btn-outline-info" data-bs-toggle="modal" data-bs-target="#transferCreditModal" onclick="openTransferCreditModal()">
          <i class="bi bi-award me-1"></i>Add Transfer Credit
        </button>
      </div>
    </form>

    <div class="modal fade" id="transferCreditModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Transfer Credit</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="transfer-credit-form" class="needs-validation" novalidate>
            <div class="modal-body">
              <p class="text-muted small">For a transferee: manually credit a subject already completed at their previous school, so it's marked done instead of needing to be taken here.</p>
              <div class="mb-3">
                <label class="form-label">Subject</label>
                <select class="form-select" id="transferCreditSubjectId" required>
                  <option value="">Select subject</option>
                </select>
                <div class="invalid-feedback">Select a subject.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Credited From (previous school course)</label>
                <input type="text" class="form-control" id="transferCreditedFrom" placeholder="e.g. GE 1102 - Mathematics in the Modern World" required />
                <div class="invalid-feedback">Required.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Remarks</label>
                <input type="text" class="form-control" id="transferCreditRemarks" placeholder="Optional" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="transfer-credit-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <hr/>
    <h6 class="mt-3">Currently Assigned</h6>
    <div id="current-assignments-list">${renderCurrentAssignmentsList(assignedIds)}</div>`;

  document.getElementById("assignment-form").addEventListener("submit", (e) => saveAssignments(e, studentId));
  document.getElementById("subject-picker-search").addEventListener("input", debounce(filterSubjectPicker, 150));
  document.getElementById("subject-picker-year").addEventListener("change", filterSubjectPicker);
  document.getElementById("subject-picker-semester").addEventListener("change", filterSubjectPicker);
  document.getElementById("assign-all-btn").addEventListener("click", selectAllStillToTake);
  document.getElementById("transfer-credit-form").addEventListener("submit", saveTransferCredit);

  filterSubjectPicker(); // apply the default (current-year) filter immediately
}

// Populates the Transfer Credit modal's subject dropdown with the student's
// required-plan subjects that aren't already credited.
function openTransferCreditModal() {
  const form = document.getElementById("transfer-credit-form");
  form.classList.remove("was-validated");
  form.reset();

  const requiredSubjects = getRequiredSubjects(currentAssignStudent, assignSubjects);
  const eligible = requiredSubjects.filter((s) => !currentCreditedMap.has(s.id));

  const select = document.getElementById("transferCreditSubjectId");
  select.innerHTML = eligible.length
    ? `<option value="">Select subject</option>` +
      eligible.map((s) => `<option value="${s.id}">${escapeHtml(s.subjectCode)} - ${escapeHtml(s.subjectName)}</option>`).join("")
    : `<option value="" disabled selected>No eligible subjects - everything required is already credited</option>`;
}

async function saveTransferCredit(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const studentId = currentAssignStudent.id;
  const subjectId = document.getElementById("transferCreditSubjectId").value;
  const btn = document.getElementById("transfer-credit-save-btn");
  btn.disabled = true;

  try {
    const docId = `${studentId}_${subjectId}`;
    await db.collection("creditedSubjects").doc(docId).set(
      {
        studentId,
        subjectId,
        creditedFrom: document.getElementById("transferCreditedFrom").value.trim(),
        remarks: document.getElementById("transferCreditRemarks").value.trim(),
        creditedBy: auth.currentUser.email,
        creditedAt: serverTimestamp()
      },
      { merge: true }
    );

    await logActivity(`Saved transfer credit for student ${studentId}`);
    const newStatus = await recomputeCreditStatus(studentId);
    showToast(`Transfer credit saved. Student status: ${newStatus}.`);

    const idx = assignStudents.findIndex((s) => s.id === studentId);
    if (idx > -1) assignStudents[idx].status = newStatus;
    renderStudentList();

    bootstrap.Modal.getInstance(document.getElementById("transferCreditModal")).hide();
    await selectStudentForAssignment(studentId);
  } catch (err) {
    showError(err, "Failed to save transfer credit.");
  } finally {
    btn.disabled = false;
  }
}

// Ticks every "still to take" subject currently visible in the picker
// (not credited, not already assigned). Respects the active year/semester/
// search filters, so you can bulk-select just 3rd-year, or clear the filters
// and grab the student's entire remaining plan. Nothing is saved until the
// admin reviews and clicks Save Assignment.
function selectAllStillToTake() {
  const boxes = document.querySelectorAll(
    '#subject-picker-table tr[data-subject-row]:not(.d-none) input[type=checkbox]:not(:disabled)'
  );
  let count = 0;
  boxes.forEach((b) => {
    if (!b.checked) {
      b.checked = true;
      count++;
    }
  });
  if (count === 0) {
    showToast("Nothing new to assign in the current view.", "info");
  } else {
    showToast(`Selected ${count} subject(s). Click Save Assignment to confirm.`, "info");
  }
}

function renderPickerRow(sub, assignedIds, requiredIds) {
  const isCredited = currentCreditedMap.has(sub.id);
  const isAssigned = assignedIds.has(sub.id);
  const isOffPlan = !requiredIds.has(sub.id);
  const missingPrereq = isCredited ? "" : unmetPrerequisites(sub, currentCreditedMap);

  const badges = [];
  if (isCredited) badges.push(`<span class="badge bg-success">Credited</span>`);
  if (isAssigned && !isCredited) badges.push(`<span class="badge bg-info text-dark">Assigned</span>`);
  if (isOffPlan) badges.push(`<span class="badge bg-secondary">Off-plan</span>`);
  if (missingPrereq) badges.push(`<span class="badge bg-warning text-dark" title="Prerequisite not yet credited">Needs ${escapeHtml(missingPrereq)} first</span>`);

  // Credited subjects are already completed - the checkbox is disabled but
  // keeps its current assigned state (a disabled+checked box still submits as
  // :checked, so nothing is accidentally removed on save).
  const checkbox = `<input class="form-check-input" type="checkbox" value="${sub.id}" id="sub-${sub.id}" ${isAssigned ? "checked" : ""} ${isCredited ? "disabled" : ""}>`;

  return `
    <tr data-subject-row data-year="${escapeHtml(sub.yearLevel)}" data-semester="${escapeHtml(sub.semester)}" data-search="${escapeHtml((sub.subjectCode + " " + sub.subjectName).toLowerCase())}">
      <td>${checkbox}</td>
      <td class="text-nowrap">${escapeHtml(sub.yearLevel)}</td>
      <td class="text-nowrap">${escapeHtml(sub.semester)}</td>
      <td class="text-nowrap"><label for="sub-${sub.id}">${escapeHtml(sub.subjectCode)}</label></td>
      <td><label for="sub-${sub.id}">${escapeHtml(sub.subjectName)}</label></td>
      <td>${escapeHtml(sub.units)}</td>
      <td class="text-nowrap">${escapeOrDash(sub.prerequisite)}</td>
      <td>${badges.join(" ") || "<span class='text-muted small'>-</span>"}</td>
    </tr>`;
}

function filterSubjectPicker() {
  const query = document.getElementById("subject-picker-search").value.trim().toLowerCase();
  const yearFilter = document.getElementById("subject-picker-year").value;
  const semFilter = document.getElementById("subject-picker-semester").value;
  document.querySelectorAll("#subject-picker-table [data-subject-row]").forEach((row) => {
    const matchesSearch = !query || row.dataset.search.includes(query);
    const matchesYear = !yearFilter || row.dataset.year === yearFilter;
    const matchesSem = !semFilter || row.dataset.semester === semFilter;
    row.classList.toggle("d-none", !(matchesSearch && matchesYear && matchesSem));
  });
}

function renderCurrentAssignmentsList(assignedIds) {
  if (!assignedIds.size) return `<div class="text-muted small">No subjects assigned yet.</div>`;
  const items = [...assignedIds]
    .map((id) => assignSubjects.find((s) => s.id === id))
    .filter(Boolean)
    .sort(sortByPlan);
  return `<ul class="list-group">${items
    .map((sub) => {
      const credited = currentCreditedMap.has(sub.id) ? ` <span class="badge bg-success">Credited</span>` : "";
      return `<li class="list-group-item d-flex justify-content-between align-items-center">
        <span><span class="text-muted small">${escapeHtml(sub.yearLevel)} &middot; ${escapeHtml(sub.semester)}</span> &nbsp; ${escapeHtml(sub.subjectCode)} - ${escapeHtml(sub.subjectName)}${credited}</span>
        <button class="btn btn-sm btn-outline-danger" onclick="removeAssignment('${sub.id}')"><i class="bi bi-x-lg"></i></button>
      </li>`;
    })
    .join("")}</ul>`;
}

async function saveAssignments(e, studentId) {
  e.preventDefault();
  const checked = [...document.querySelectorAll('#assignment-form input[type=checkbox]:checked')].map((c) => c.value);
  const existingIds = new Set(currentAssignments.map((a) => a.subjectId));
  const toAdd = checked.filter((id) => !existingIds.has(id));
  const toRemove = currentAssignments.filter((a) => !checked.includes(a.subjectId));

  if (toAdd.length === 0 && toRemove.length === 0) {
    showToast("No changes to save.", "info");
    return;
  }

  try {
    const batch = db.batch();
    toAdd.forEach((subjectId) => {
      const ref = db.collection("studentSubjects").doc();
      batch.set(ref, { studentId, subjectId, assignedAt: serverTimestamp() });
    });
    toRemove.forEach((a) => batch.delete(db.collection("studentSubjects").doc(a.id)));
    await batch.commit();
    await logActivity(`Updated subject assignments for student ${studentId}`);
    showToast("Assignment saved.");
    await selectStudentForAssignment(studentId);
  } catch (err) {
    showError(err, "Failed to save assignment.");
  }
}

async function removeAssignment(subjectId) {
  const assignment = currentAssignments.find((a) => a.subjectId === subjectId);
  if (!assignment) return;
  if (!confirm("Remove this subject assignment?")) return;
  try {
    await db.collection("studentSubjects").doc(assignment.id).delete();
    await logActivity(`Removed subject assignment ${subjectId}`);
    showToast("Assignment removed.");
    await selectStudentForAssignment(assignment.studentId);
  } catch (err) {
    showError(err, "Failed to remove assignment.");
  }
}
