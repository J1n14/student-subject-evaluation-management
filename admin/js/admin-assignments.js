let assignStudents = [];
let assignSubjects = []; // full subject catalog (needed for curriculum/track matching + prereq lookup)
let currentAssignments = []; // studentSubjects docs for the selected student
let currentCreditedMap = new Map(); // subjectId -> credited record for the selected student
let currentDisplaySubjects = []; // required + off-plan subjects for the selected student (prereq lookup scope)
let selectedAssignmentStudentId = null;
let currentAssignmentStudent = null;

// Admin-configurable unit load policy, stored at settings/unitPolicy.
// Falls back to these defaults until an admin saves their own values.
let unitPolicy = { minUnits: 15, maxUnits: 24 };
let currentTermPolicy = { academicYear: "", semester: "" };

// Fetches the saved unit policy into the in-memory `unitPolicy` var. Purely
// a data load - no DOM involved, so it's safe to call before the assignment
// panel (where the compact policy control lives) has been rendered.
async function loadUnitPolicy() {
  try {
    const doc = await db.collection("settings").doc("unitPolicy").get();
    if (doc.exists) {
      const d = doc.data();
      if (d.minUnits != null) unitPolicy.minUnits = Number(d.minUnits);
      if (d.maxUnits != null) unitPolicy.maxUnits = Number(d.maxUnits);
    }
  } catch (err) {
    console.warn("Could not load unit policy, using defaults.", err);
  }
}

// Toggles the small inline min/max editor shown next to the running unit
// total (see selectStudentForAssignment). No standalone settings card -
// the policy only matters in the context of assigning a specific student's
// subjects, so it lives right next to that running total.
function toggleUnitPolicyEditor(show) {
  const row = document.getElementById("unit-policy-edit-row");
  if (!row) return;
  row.classList.toggle("d-none", !show);
  row.classList.toggle("d-flex", show);
  if (show) {
    document.getElementById("policy-min-units").value = unitPolicy.minUnits;
    document.getElementById("policy-max-units").value = unitPolicy.maxUnits;
  }
}

async function saveUnitPolicyInline() {
  const minUnits = Number(document.getElementById("policy-min-units").value);
  const maxUnits = Number(document.getElementById("policy-max-units").value);
  if (!minUnits || !maxUnits || minUnits > maxUnits) {
    showToast("Enter a valid minimum and maximum (minimum must not exceed maximum).", "error");
    return;
  }
  try {
    await db.collection("settings").doc("unitPolicy").set(
      { minUnits, maxUnits, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email },
      { merge: true }
    );
    unitPolicy = { minUnits, maxUnits };
    const display = document.getElementById("unit-policy-display");
    if (display) display.textContent = `Policy: ${minUnits}–${maxUnits} units`;
    toggleUnitPolicyEditor(false);
    showToast("Unit load policy saved.");
    updateSelectedUnitsTotal();
  } catch (err) {
    showError(err, "Failed to save unit policy.");
  }
}

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
// Delegates to the single shared rule in shared/js/utils.js
// (getUnmetPrerequisites) so the Assignment page and the Evaluation page's
// mark-credited flow can never disagree about what counts as "satisfied".
function unmetPrerequisites(subject, creditedMap) {
  return getUnmetPrerequisites(subject, creditedMap, assignSubjects)
    .map((m) => m.code)
    .join(", ");
}

async function initAdminAssignments(content) {
  content.innerHTML = `
    <div class="section-card mb-3">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-primary rounded-pill me-1">1</span>Select Student</label>
      <div class="position-relative">
        <input type="text" class="form-control" id="student-search" placeholder="Search by name or email..." autocomplete="off" />
        <div class="list-group position-absolute w-100 mt-1" id="student-search-results" style="display:none;"></div>
      </div>
      <div id="selected-student-chip" class="mt-2"></div>
    </div>

    <div class="section-card mb-3">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-secondary rounded-pill me-1">Policy</span>Current Term Policy</label>
      <div class="d-flex gap-2 align-items-center">
        <input type="text" class="form-control form-control-sm" style="max-width:160px" id="policy-academic-year" placeholder="2025-2026" />
        <select class="form-select form-select-sm" style="max-width:160px" id="policy-semester">
          <option value="">Select term</option>
          <option value="1st Semester">1st Semester</option>
          <option value="2nd Semester">2nd Semester</option>
          <option value="Midterm">Midterm</option>
          <option value="Summer">Summer</option>
        </select>
        <button type="button" class="btn btn-sm btn-outline-primary" id="term-policy-save-btn">Save term</button>
        <div class="small text-muted ms-3">Current: <strong id="term-policy-display">not set yet</strong></div>
      </div>
    </div>

    <div class="section-card" id="assignment-section" style="display:none">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-primary rounded-pill me-1">2</span>Assign Subjects</label>
      <div id="assignment-panel"></div>
    </div>`;

  document.getElementById("student-search").addEventListener("input", debounce(renderStudentSearchResults, 150));
  document.getElementById("student-search").addEventListener("focus", renderStudentSearchResults);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#student-search") && !e.target.closest("#student-search-results")) {
      const results = document.getElementById("student-search-results");
      if (results) results.style.display = "none";
    }
  });
  const termSaveBtn = document.getElementById("term-policy-save-btn");
  if (termSaveBtn) termSaveBtn.addEventListener("click", saveCurrentTermPolicyInline);

  // Load the FULL subject catalog (not just the current year, and not just
  // "Active") so we can match by curriculum + track and resolve prerequisites.
  const [studentsSnap, subjectsSnap] = await Promise.all([
    db.collection("students").orderBy("fullName").get(),
    db.collection("subjects").get()
  ]);
  assignStudents = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  assignSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  await Promise.all([loadUnitPolicy(), loadCurrentTermPolicy()]);
}

function renderStudentSearchResults() {
  const input = document.getElementById("student-search");
  const search = input.value.toLowerCase().trim();
  const results = document.getElementById("student-search-results");

  const matches = assignStudents
    .filter((s) => !search || s.fullName.toLowerCase().includes(search) || (s.email || "").toLowerCase().includes(search))
    .slice(0, 8);

  results.innerHTML = matches.length
    ? matches
        .map(
          (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="pickStudentForAssignment('${s.id}')">
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

function pickStudentForAssignment(studentId) {
  selectedAssignmentStudentId = studentId;
  document.getElementById("student-search-results").style.display = "none";
  document.getElementById("student-search").value = "";

  const s = assignStudents.find((x) => x.id === studentId);
  document.getElementById("selected-student-chip").innerHTML = `
    <div class="selected-student-chip">
      <div>
        <strong>${escapeHtml(s.fullName)}</strong>
        <span class="text-muted small ms-2">${escapeHtml(s.email)}</span>
        <span class="ms-2">${statusBadge(s.status || "Pending")}</span>
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearSelectedAssignmentStudent()">
        <i class="bi bi-arrow-repeat me-1"></i>Change student
      </button>
    </div>`;

  document.getElementById("assignment-section").style.display = "block";
  selectStudentForAssignment(studentId);
}

function clearSelectedAssignmentStudent() {
  selectedAssignmentStudentId = null;
  document.getElementById("selected-student-chip").innerHTML = "";
  document.getElementById("assignment-section").style.display = "none";
  document.getElementById("assignment-panel").innerHTML = "";
  const input = document.getElementById("student-search");
  input.value = "";
  input.focus();
}

async function loadCurrentTermPolicy() {
  try {
    const doc = await db.collection("settings").doc("currentTerm").get();
    if (doc.exists) {
      const d = doc.data();
      currentTermPolicy = {
        academicYear: d.academicYear || "",
        semester: d.semester || ""
      };
    } else {
      currentTermPolicy = { academicYear: "", semester: "" };
    }
  } catch (err) {
    console.warn("Could not load current term policy, using defaults.", err);
    currentTermPolicy = { academicYear: "", semester: "" };
  }

  const yearInput = document.getElementById("policy-academic-year");
  const semesterInput = document.getElementById("policy-semester");
  if (yearInput) yearInput.value = currentTermPolicy.academicYear || "";
  if (semesterInput) semesterInput.value = currentTermPolicy.semester || "";

  const display = document.getElementById("term-policy-display");
  if (display) {
    display.textContent = currentTermPolicy.academicYear && currentTermPolicy.semester
      ? `Current term: ${currentTermPolicy.academicYear} • ${currentTermPolicy.semester}`
      : "Current term: not set yet";
  }
}

async function saveCurrentTermPolicyInline() {
  const academicYear = (document.getElementById("policy-academic-year").value || "").trim();
  const semester = document.getElementById("policy-semester").value;
  if (!academicYear || !semester) {
    showToast("Enter both the academic year and semester for the current term.", "error");
    return;
  }

  try {
    await db.collection("settings").doc("currentTerm").set(
      { academicYear, semester, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.email },
      { merge: true }
    );
    currentTermPolicy = { academicYear, semester };
    const display = document.getElementById("term-policy-display");
    if (display) display.textContent = `Current term: ${academicYear} • ${semester}`;
    showToast("Current term policy saved.");
    if (currentAssignmentStudent) {
      await selectStudentForAssignment(currentAssignmentStudent.id);
    }
  } catch (err) {
    showError(err, "Failed to save current term policy.");
  }
}

function getSubjectEligibilityIssues(subject, student) {
  const issues = [];

  if (currentTermPolicy.academicYear && subject.academicYear && String(subject.academicYear) !== String(currentTermPolicy.academicYear)) {
    issues.push(`not offered in ${subject.academicYear}`);
  }
  if (currentTermPolicy.semester && subject.semester && String(subject.semester) !== String(currentTermPolicy.semester)) {
    issues.push(`not offered in ${subject.semester}`);
  }

  if (student?.academicHold) {
    issues.push("student has an academic hold");
  }

  const minGpa = Number(subject.minGpa);
  const studentGpa = Number(student?.gpa);
  if (!Number.isNaN(minGpa) && minGpa > 0 && !Number.isNaN(studentGpa) && studentGpa < minGpa) {
    issues.push(`requires GPA ${minGpa} or higher`);
  }

  if (subject.requiredStanding && student?.academicStanding && String(subject.requiredStanding) !== String(student.academicStanding)) {
    issues.push(`requires ${subject.requiredStanding}`);
  }

  return issues;
}

async function selectStudentForAssignment(studentId) {
  const student = assignStudents.find((s) => s.id === studentId);
  currentAssignmentStudent = student;
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
  currentDisplaySubjects = displaySubjects;

  const years = [...new Set(displaySubjects.map((s) => s.yearLevel))].sort(
    (a, b) => YEAR_ORDER.indexOf(a) - YEAR_ORDER.indexOf(b)
  );
  const semesters = [...new Set(displaySubjects.map((s) => s.semester))].sort(
    (a, b) => SEMESTER_ORDER.indexOf(a) - SEMESTER_ORDER.indexOf(b)
  );

  const emptyNotice =
    displaySubjects.length === 0
      ? `<div class="alert alert-warning mb-3">No catalog subjects match this student's ${
          student.curriculum ? `<strong>${escapeHtml(student.curriculum)} curriculum</strong>` : "curriculum"
        }${student.track ? ` / <strong>${escapeHtml(student.track)} track</strong>` : ""} yet. Add matching subjects in the Subjects panel first.</div>`
      : "";

  panel.innerHTML = `
    <div class="d-flex justify-content-between align-items-start mb-3">
      <div>
        <h5 class="mb-0">${escapeHtml(student.fullName)}</h5>
        <div class="text-muted small">${escapeOrDash(student.curriculum)} &middot; ${escapeOrDash(student.track)} &middot; ${escapeHtml(student.yearLevel)}</div>
      </div>
    </div>

    <div id="enrollment-readiness" class="mb-3"></div>

    ${emptyNotice}

    <form id="assignment-form">
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
      <div class="d-flex flex-wrap align-items-center gap-3 small text-muted mb-3">
        <span><span class="legend-dot" style="background:#2e9e6a"></span>Available to take</span>
        <span><span class="legend-dot" style="background:#3a86c8"></span>Currently assigned</span>
        <span><span class="legend-dot" style="background:#adb5bd"></span>Already credited</span>
        <span><span class="legend-dot" style="background:#e2a53a"></span>Needs prerequisite first</span>
        <span><span class="legend-dot" style="background:#dc3545"></span>Unavailable (term/GPA/hold)</span>
      </div>
      <div class="text-muted small mb-2">
        Showing the current year by default. Choose <strong>All Years</strong> to assign back-year subjects a transferee or irregular student still needs.
      </div>
      <div id="subject-picker-container" style="max-height:460px; overflow-y:auto;" class="border rounded p-2 mb-3">
        ${displaySubjects.length ? renderSubjectBoxGrid(displaySubjects, assignedIds, requiredIds, displaySubjects, student) : `<div class="text-center text-muted py-3">No subjects to display.</div>`}
      </div>
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-1">
        <div class="small">
          Selected units: <strong id="selected-units-total">0</strong>
          <span class="text-muted" id="unit-policy-hint"></span>
        </div>
        <div class="small text-muted d-flex align-items-center gap-2">
          <span id="unit-policy-display">Policy: ${unitPolicy.minUnits}–${unitPolicy.maxUnits} units</span>
          <button type="button" class="btn btn-link btn-sm p-0" id="unit-policy-edit-toggle">Edit</button>
        </div>
      </div>
      <div class="d-none align-items-center gap-2 mb-2" id="unit-policy-edit-row">
        <input type="number" min="1" class="form-control form-control-sm" id="policy-min-units" style="width:80px" value="${unitPolicy.minUnits}" />
        <span class="small text-muted">to</span>
        <input type="number" min="1" class="form-control form-control-sm" id="policy-max-units" style="width:80px" value="${unitPolicy.maxUnits}" />
        <button type="button" class="btn btn-sm btn-primary" id="unit-policy-save-btn">Save</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" id="unit-policy-cancel-btn">Cancel</button>
      </div>
      <div class="small text-muted mb-2">Edit the current term policy at the top of this page before saving assignments.</div>
      <div class="d-flex gap-2 flex-wrap">
        <button type="submit" class="btn btn-primary"><i class="bi bi-save me-1"></i>Save Assignment</button>
        <button type="button" class="btn btn-outline-success" id="assign-all-btn"><i class="bi bi-check2-all me-1"></i>Assign all still-to-take</button>
        <button type="button" class="btn btn-outline-secondary" id="unselect-all-btn"><i class="bi bi-x-square me-1"></i>Unselect All</button>
      </div>
    </form>
    <hr/>
    <h6 class="mt-3">Currently Assigned</h6>
    <div id="current-assignments-list">${renderCurrentAssignmentsList(assignedIds)}</div>`;

  document.getElementById("assignment-form").addEventListener("submit", (e) => saveAssignments(e, studentId));
  document.getElementById("subject-picker-search").addEventListener("input", debounce(filterSubjectPicker, 150));
  document.getElementById("subject-picker-year").addEventListener("change", filterSubjectPicker);
  document.getElementById("subject-picker-semester").addEventListener("change", filterSubjectPicker);
  document.getElementById("assign-all-btn").addEventListener("click", () => {
    selectAllStillToTake();
    updateSelectedUnitsTotal();
  });
  document.getElementById("unselect-all-btn").addEventListener("click", unselectAll);
  document.getElementById("subject-picker-container").addEventListener("change", (e) => {
    if (e.target.matches('input[type="checkbox"]')) updateSelectedUnitsTotal();
  });
  // Clicking anywhere on a row (not just the checkbox) toggles it, for a
  // bigger, easier-to-hit target - same convenience the old box picker had.
  document.getElementById("subject-picker-container").addEventListener("click", (e) => {
    if (e.target.matches('input[type="checkbox"]')) return;
    const row = e.target.closest("tr[data-subject-row]");
    if (!row) return;
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb && !cb.disabled) {
      cb.checked = !cb.checked;
      updateSelectedUnitsTotal();
    }
  });
  document.getElementById("unit-policy-edit-toggle").addEventListener("click", () => toggleUnitPolicyEditor(true));
  document.getElementById("unit-policy-cancel-btn").addEventListener("click", () => toggleUnitPolicyEditor(false));
  document.getElementById("unit-policy-save-btn").addEventListener("click", saveUnitPolicyInline);
  document.getElementById("term-policy-save-btn").addEventListener("click", saveCurrentTermPolicyInline);

  filterSubjectPicker(); // apply the default (current-year) filter immediately
  updateSelectedUnitsTotal();
}

// ---------- Picker table rendering (grouped by Year > Semester) ----------

function renderSubjectBoxGrid(displaySubjects, assignedIds, requiredIds, requiredSubjects, student) {
  const years = [...new Set(displaySubjects.map((s) => s.yearLevel))].sort(
    (a, b) => YEAR_ORDER.indexOf(a) - YEAR_ORDER.indexOf(b)
  );

  return years
    .map((year) => {
      const yearSubs = displaySubjects.filter((s) => s.yearLevel === year);
      const semBlocks = SEMESTER_ORDER.filter((sem) => yearSubs.some((s) => s.semester === sem))
        .map((sem) => {
          const rows = yearSubs.filter((s) => s.semester === sem).sort((a, b) => (a.subjectCode || "").localeCompare(b.subjectCode || ""));
          return `
        <div class="sem-group" data-sem-group>
          <div class="sem-head">${escapeHtml(sem)}<span class="sem-count">${rows.length} subject(s)</span></div>
          <div class="table-responsive">
            <table class="table table-sm table-bordered subj-picker-table">
              <thead>
                <tr><th></th><th>Code</th><th>Subject Name</th><th>Units</th><th>Prerequisite</th><th>Status</th></tr>
              </thead>
              <tbody>${rows.map((sub) => renderSubjectPickerRow(sub, assignedIds, requiredIds, requiredSubjects, student)).join("")}</tbody>
            </table>
          </div>
        </div>`;
        })
        .join("");
      return `
      <div class="year-block" data-year-block>
        <div class="year-head"><span>${escapeHtml(year)}</span></div>
        ${semBlocks}
      </div>`;
    })
    .join("");
}

function renderSubjectPickerRow(sub, assignedIds, requiredIds, requiredSubjects, student) {
  const isCredited = currentCreditedMap.has(sub.id);
  const isAssigned = assignedIds.has(sub.id);
  const isOffPlan = !requiredIds.has(sub.id);
  const missingPrereq = isCredited ? "" : unmetPrerequisites(sub, currentCreditedMap, requiredSubjects);
  const eligibilityIssues = getSubjectEligibilityIssues(sub, student);
  const ineligible = eligibilityIssues.length > 0;

  let stateClass = "row-available";
  if (isCredited) stateClass = "row-credited";
  else if (isOffPlan) stateClass = "row-offplan";
  else if (missingPrereq) stateClass = "row-prereq";
  else if (ineligible) stateClass = "row-unavailable";
  else if (isAssigned) stateClass = "row-assigned";

  const badges = [];
  if (isCredited) badges.push(`<span class="badge bg-secondary">Credited</span>`);
  if (isAssigned && !isCredited) badges.push(`<span class="badge bg-info text-dark">Assigned</span>`);
  if (isOffPlan) badges.push(`<span class="badge bg-secondary">Off-plan</span>`);
  if (missingPrereq)
    badges.push(`<span class="badge bg-warning text-dark" title="Prerequisite not yet credited"><i class="bi bi-lock-fill me-1"></i>Needs ${escapeHtml(missingPrereq)} first</span>`);
  if (ineligible)
    badges.push(`<span class="badge bg-danger" title="${escapeHtml(eligibilityIssues.join("; "))}"><i class="bi bi-slash-circle me-1"></i>Unavailable: ${escapeHtml(eligibilityIssues.join("; "))}</span>`);
  if (!badges.length) badges.push(`<span class="badge bg-success">Available</span>`);

  // Credited subjects are already completed - the checkbox is disabled but
  // keeps its current assigned state (a disabled+checked box still submits as
  // :checked, so nothing is accidentally removed on save). Subjects with an
  // unmet prerequisite or eligibility issue are also disabled UNLESS they're
  // already assigned - that keeps an admin from being able to check a new
  // blocked subject while still letting them remove a legacy assignment.
  const prereqLocked = !!missingPrereq && !isAssigned;
  const blocked = (prereqLocked || (ineligible && !isAssigned));
  return `
    <tr class="${stateClass}" data-subject-row data-year="${escapeHtml(sub.yearLevel)}" data-semester="${escapeHtml(sub.semester)}" data-search="${escapeHtml((sub.subjectCode + " " + sub.subjectName).toLowerCase())}">
      <td><input class="form-check-input" type="checkbox" value="${sub.id}" ${isAssigned ? "checked" : ""} ${isCredited || blocked ? "disabled" : ""} ${blocked ? `title="Blocked: ${escapeHtml((missingPrereq ? `prerequisite ${missingPrereq}` : "") + (missingPrereq && eligibilityIssues.length ? "; " : "") + eligibilityIssues.join("; "))}"` : ""}></td>
      <td class="subj-code-cell">${escapeHtml(sub.subjectCode)}</td>
      <td>${escapeHtml(sub.subjectName)}</td>
      <td>${escapeHtml(sub.units)}</td>
      <td>${escapeOrDash(sub.prerequisite)}</td>
      <td>${badges.join(" ")}</td>
    </tr>`;
}

// Ticks every "still to take" subject currently visible in the picker
// (not credited, not already assigned). Respects the active year/semester/
// search filters, so you can bulk-select just 3rd-year, or clear the filters
// and grab the student's entire remaining plan. Nothing is saved until the
// admin reviews and clicks Save Assignment.
function selectAllStillToTake() {
  const boxes = document.querySelectorAll(
    '#subject-picker-container [data-subject-row]:not(.d-none) input[type=checkbox]:not(:disabled)'
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

// Unchecks every non-disabled (i.e. not-already-credited) checkbox currently
// in the picker, regardless of the active year/semester/search filter, so a
// full reset always works even if a filter is narrowing the view.
function unselectAll() {
  const boxes = document.querySelectorAll('#subject-picker-container input[type=checkbox]:not(:disabled)');
  let count = 0;
  boxes.forEach((b) => {
    if (b.checked) {
      b.checked = false;
      count++;
    }
  });
  updateSelectedUnitsTotal();
  if (count === 0) {
    showToast("Nothing was selected.", "info");
  } else {
    showToast(`Unselected ${count} subject(s).`, "info");
  }
}

function updateSelectedUnitsTotal() {
  const checked = [...document.querySelectorAll('#assignment-form input[type=checkbox]:checked')];
  const total = checked.reduce((sum, box) => {
    const sub = assignSubjects.find((s) => s.id === box.value);
    return sum + (sub ? Number(sub.units) || 0 : 0);
  }, 0);
  const totalEl = document.getElementById("selected-units-total");
  if (totalEl) totalEl.textContent = total;

  const hintEl = document.getElementById("unit-policy-hint");
  if (hintEl && unitPolicy) {
    hintEl.textContent = `(policy: ${unitPolicy.minUnits}-${unitPolicy.maxUnits} units)`;
    totalEl.className = total > unitPolicy.maxUnits ? "text-danger" : total < unitPolicy.minUnits ? "text-warning" : "text-success";
  }
  return total;
}

function filterSubjectPicker() {
  const query = document.getElementById("subject-picker-search").value.trim().toLowerCase();
  const yearFilter = document.getElementById("subject-picker-year").value;
  const semFilter = document.getElementById("subject-picker-semester").value;

  document.querySelectorAll("#subject-picker-container [data-subject-row]").forEach((box) => {
    const matchesSearch = !query || box.dataset.search.includes(query);
    const matchesYear = !yearFilter || box.dataset.year === yearFilter;
    const matchesSem = !semFilter || box.dataset.semester === semFilter;
    box.classList.toggle("d-none", !(matchesSearch && matchesYear && matchesSem));
  });

  // Hide semester/year groups that end up with nothing visible, so filtering
  // doesn't leave a trail of empty section headers.
  document.querySelectorAll("#subject-picker-container [data-sem-group]").forEach((group) => {
    const anyVisible = [...group.querySelectorAll("[data-subject-row]")].some((b) => !b.classList.contains("d-none"));
    group.classList.toggle("d-none", !anyVisible);
  });
  document.querySelectorAll("#subject-picker-container [data-year-block]").forEach((block) => {
    const anyVisible = [...block.querySelectorAll("[data-subject-row]")].some((b) => !b.classList.contains("d-none"));
    block.classList.toggle("d-none", !anyVisible);
  });
}

function renderCurrentAssignmentsList(assignedIds) {
  if (!assignedIds.size) return `<div class="text-muted small">No subjects assigned yet.</div>`;
  const items = [...assignedIds]
    .map((id) => assignSubjects.find((s) => s.id === id))
    .filter(Boolean)
    .sort(sortByPlan);
  return `
    <div class="table-responsive">
      <table class="table table-sm table-bordered assigned-table mb-0">
        <thead>
          <tr><th>Code</th><th>Subject Name</th><th>Year</th><th>Semester</th><th>Units</th><th>Status</th><th class="text-end">Action</th></tr>
        </thead>
        <tbody>
          ${items
            .map((sub) => {
              const credited = currentCreditedMap.has(sub.id);
              return `<tr>
                <td class="subj-code-cell">${escapeHtml(sub.subjectCode)}</td>
                <td>${escapeHtml(sub.subjectName)}</td>
                <td>${escapeHtml(sub.yearLevel)}</td>
                <td>${escapeHtml(sub.semester)}</td>
                <td>${escapeHtml(sub.units)}</td>
                <td>${credited ? `<span class="badge bg-secondary">Credited</span>` : `<span class="badge bg-info text-dark">Assigned</span>`}</td>
                <td class="text-end">
                  ${credited ? "" : `<button type="button" class="btn btn-sm btn-outline-danger" title="Remove assignment" onclick="removeAssignment('${sub.id}')"><i class="bi bi-x-lg"></i></button>`}
                </td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
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

  // Hard prerequisite guard: only applies to NEWLY added subjects (already-
  // assigned ones stay untouched so an admin can still remove a legacy
  // assignment made before this check existed). Re-checks here even though
  // the checkbox is already disabled in the UI for these subjects, since a
  // disabled attribute can be removed client-side (devtools) - this is the
  // check that actually can't be bypassed without editing the source.
  const blocked = toAdd
    .map((id) => assignSubjects.find((s) => s.id === id))
    .filter(Boolean)
    .map((sub) => ({
      sub,
      missing: unmetPrerequisites(sub, currentCreditedMap, currentDisplaySubjects),
      eligibilityIssues: getSubjectEligibilityIssues(sub, currentAssignmentStudent)
    }))
    .filter((x) => x.missing || x.eligibilityIssues.length);

  if (blocked.length > 0) {
    const list = blocked
      .map((x) => {
        const reasons = [];
        if (x.missing) reasons.push(`prerequisite ${x.missing}`);
        if (x.eligibilityIssues.length) reasons.push(x.eligibilityIssues.join("; "));
        return `${x.sub.subjectCode} (${reasons.join(" | ")})`;
      })
      .join("; ");
    showToast(`Cannot save: blocked subject(s) - ${list}.`, "error");
    return;
  }

  // Unit load check against the admin-configured policy (see the Unit Load
  // Policy panel at the top of this page). Overload requires an explicit
  // Yes/No confirmation per the required workflow; underload is flagged the
  // same way so an admin can consciously override either direction.
  const totalUnits = checked.reduce((sum, id) => {
    const sub = assignSubjects.find((s) => s.id === id);
    return sum + (sub ? Number(sub.units) || 0 : 0);
  }, 0);

  if (totalUnits > unitPolicy.maxUnits) {
    const allowOverload = confirm(
      `This assignment totals ${totalUnits} units, exceeding the maximum load of ${unitPolicy.maxUnits} units.\n\nAllow this student to overload?\nOK = Yes, Cancel = No.`
    );
    if (!allowOverload) {
      showToast("Save cancelled. Adjust the selection to fit the unit limit, or confirm the overload.", "warning");
      return;
    }
  } else if (checked.length > 0 && totalUnits < unitPolicy.minUnits) {
    const allowUnderload = confirm(
      `This assignment totals ${totalUnits} units, below the minimum load of ${unitPolicy.minUnits} units (underload).\n\nSave anyway?\nOK = Yes, Cancel = No.`
    );
    if (!allowUnderload) {
      showToast("Save cancelled. Add more subjects to meet the minimum load, or confirm the underload.", "warning");
      return;
    }
  }

  try {
    const batch = db.batch();
    const isOverload = totalUnits > unitPolicy.maxUnits;
    toAdd.forEach((subjectId) => {
      const ref = db.collection("studentSubjects").doc();
      batch.set(ref, { studentId, subjectId, assignedAt: serverTimestamp(), overload: isOverload });
    });
    // Keep the overload flag on EXISTING (kept) assignments in sync with the
    // new total too - otherwise a total that crosses the threshold on a
    // later save only tags the newly-added subjects, and reports based on
    // the overload field undercount.
    currentAssignments
      .filter((a) => checked.includes(a.subjectId) && a.overload !== isOverload)
      .forEach((a) => batch.update(db.collection("studentSubjects").doc(a.id), { overload: isOverload }));
    toRemove.forEach((a) => batch.delete(db.collection("studentSubjects").doc(a.id)));
    await batch.commit();
    await logActivity(`Updated subject assignments for student ${studentId} (${totalUnits} units${isOverload ? ", overload approved" : ""})`);
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