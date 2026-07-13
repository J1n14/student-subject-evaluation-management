let assignStudents = [];
let assignSubjects = [];
let currentAssignments = []; // studentSubjects docs for the selected student

const SEMESTER_ORDER = ["1st Semester", "2nd Semester", "Midterm", "Summer"];

function subjectsForStudentYear(yearLevel) {
  return assignSubjects
    .filter((s) => s.yearLevel === yearLevel)
    .sort((a, b) => {
      const semDiff = SEMESTER_ORDER.indexOf(a.semester) - SEMESTER_ORDER.indexOf(b.semester);
      if (semDiff !== 0) return semDiff;
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });
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

  const [studentsSnap, subjectsSnap] = await Promise.all([
    db.collection("students").orderBy("fullName").get(),
    db.collection("subjects").where("status", "==", "Active").get()
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
  const panel = document.getElementById("assignment-panel");
  panel.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const snap = await db.collection("studentSubjects").where("studentId", "==", studentId).get();
  currentAssignments = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const assignedIds = new Set(currentAssignments.map((a) => a.subjectId));
  const yearSubjects = subjectsForStudentYear(student.yearLevel);
  const semesters = [...new Set(yearSubjects.map((s) => s.semester))].sort(
    (a, b) => SEMESTER_ORDER.indexOf(a) - SEMESTER_ORDER.indexOf(b)
  );

  panel.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-3">
      <div>
        <h5 class="mb-0">${escapeHtml(student.fullName)}</h5>
        <div class="text-muted small">${escapeHtml(student.id)} &middot; ${escapeHtml(student.track)} &middot; ${escapeHtml(student.yearLevel)}</div>
      </div>
      ${statusBadge(student.status || "Pending")}
    </div>
    <form id="assignment-form">
      <label class="form-label">Select subjects to assign (${escapeHtml(student.yearLevel)})</label>
      <div class="d-flex gap-2 mb-2">
        <input type="text" class="form-control form-control-sm" id="subject-picker-search" placeholder="Filter by code or name..." />
        <select class="form-select form-select-sm" style="max-width:160px" id="subject-picker-semester">
          <option value="">All Semesters</option>
          ${semesters.map((sem) => `<option value="${escapeHtml(sem)}">${escapeHtml(sem)}</option>`).join("")}
        </select>
      </div>
      <div class="table-responsive border rounded mb-3" style="max-height:400px; overflow-y:auto;">
        <table class="table table-sm table-hover align-middle mb-0" id="subject-picker-table">
          <thead class="sticky-top bg-white"><tr><th></th><th>Code</th><th>Subject Name</th><th>Units</th><th class="text-nowrap">Semester</th></tr></thead>
          <tbody>
            ${
              yearSubjects.length
                ? yearSubjects
                    .map(
                      (sub) => `
              <tr data-subject-row data-semester="${escapeHtml(sub.semester)}" data-search="${escapeHtml((sub.subjectCode + " " + sub.subjectName).toLowerCase())}">
                <td><input class="form-check-input" type="checkbox" value="${sub.id}" id="sub-${sub.id}" ${assignedIds.has(sub.id) ? "checked" : ""}></td>
                <td><label for="sub-${sub.id}">${escapeHtml(sub.subjectCode)}</label></td>
                <td><label for="sub-${sub.id}">${escapeHtml(sub.subjectName)}</label></td>
                <td>${sub.units}</td>
                <td class="text-nowrap">${escapeHtml(sub.semester)}</td>
              </tr>`
                    )
                    .join("")
                : `<tr><td colspan="5" class="text-center text-muted py-3">No active subjects for ${escapeHtml(student.yearLevel)}.</td></tr>`
            }
          </tbody>
        </table>
      </div>
      <button type="submit" class="btn btn-primary"><i class="bi bi-save me-1"></i>Save Assignment</button>
    </form>
    <hr/>
    <h6 class="mt-3">Currently Assigned</h6>
    <div id="current-assignments-list">${renderCurrentAssignmentsList(assignedIds)}</div>`;

  document.getElementById("assignment-form").addEventListener("submit", (e) => saveAssignments(e, studentId));
  document.getElementById("subject-picker-search").addEventListener("input", debounce(filterSubjectPicker, 150));
  document.getElementById("subject-picker-semester").addEventListener("change", filterSubjectPicker);
}

function filterSubjectPicker() {
  const query = document.getElementById("subject-picker-search").value.trim().toLowerCase();
  const semFilter = document.getElementById("subject-picker-semester").value;
  document.querySelectorAll("#subject-picker-table [data-subject-row]").forEach((row) => {
    const matchesSearch = !query || row.dataset.search.includes(query);
    const matchesSem = !semFilter || row.dataset.semester === semFilter;
    row.classList.toggle("d-none", !(matchesSearch && matchesSem));
  });
}

function renderCurrentAssignmentsList(assignedIds) {
  if (!assignedIds.size) return `<div class="text-muted small">No subjects assigned yet.</div>`;
  return `<ul class="list-group">${[...assignedIds]
    .map((id) => {
      const sub = assignSubjects.find((s) => s.id === id);
      if (!sub) return "";
      return `<li class="list-group-item d-flex justify-content-between align-items-center">
        ${escapeHtml(sub.subjectCode)} - ${escapeHtml(sub.subjectName)}
        <button class="btn btn-sm btn-outline-danger" onclick="removeAssignment('${id}')"><i class="bi bi-x-lg"></i></button>
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
    await recomputeStudentStatus(studentId);
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
    await recomputeStudentStatus(assignment.studentId);
    await selectStudentForAssignment(assignment.studentId);
  } catch (err) {
    showError(err, "Failed to remove assignment.");
  }
}
