let reportsProfile = null;
let reportsStudents = []; // full student list, loaded once for the search box
let reportSelectedStudentId = null; // null = report covers all students

async function initAdminReports(content, profile) {
  reportsProfile = profile;
  reportSelectedStudentId = null;
  content.innerHTML = `
    <div class="section-card no-print mb-3">
      <h6 class="mb-3"><i class="bi bi-file-earmark-bar-graph me-1"></i>Generate Report</h6>
      <div class="row g-2 align-items-end mb-3">
        <div class="col-md-4">
          <label class="form-label small">Report Type</label>
          <select class="form-select" id="report-type">
            <option value="summary">Summary Overview</option>
            <option value="assignments">Subject Assignments</option>
            <option value="credits">Credited Subjects</option>
          </select>
        </div>
        <div class="col-md-3">
          <button class="btn btn-primary w-100" onclick="generateReport()"><i class="bi bi-eye me-1"></i>Generate</button>
        </div>
        <div class="col-md-3">
          <button class="btn btn-outline-secondary w-100" onclick="window.print()"><i class="bi bi-printer me-1"></i>Print</button>
        </div>
      </div>
      <label class="form-label small">Student</label>
      <div class="position-relative" style="max-width:420px">
        <input type="text" class="form-control" id="report-student-search" placeholder="Search by name or email... (leave blank for all students)" autocomplete="off" />
        <div class="list-group position-absolute w-100 mt-1" id="report-student-search-results" style="display:none;"></div>
      </div>
      <div id="report-selected-student-chip" class="mt-2"></div>
    </div>
    <div id="report-output"></div>`;

  document.getElementById("report-type").addEventListener("change", generateReport);
  document.getElementById("report-student-search").addEventListener("input", debounce(renderReportStudentResults, 150));
  document.getElementById("report-student-search").addEventListener("focus", renderReportStudentResults);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#report-student-search") && !e.target.closest("#report-student-search-results")) {
      const results = document.getElementById("report-student-search-results");
      if (results) results.style.display = "none";
    }
  });

  const snap = await db.collection("students").orderBy("fullName").get();
  reportsStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderReportScopeChip();
  await generateReport();
}

function renderReportStudentResults() {
  const input = document.getElementById("report-student-search");
  const search = input.value.toLowerCase().trim();
  const results = document.getElementById("report-student-search-results");

  const matches = reportsStudents
    .filter((s) => !search || s.fullName.toLowerCase().includes(search) || (s.email || "").toLowerCase().includes(search))
    .slice(0, 8);

  results.innerHTML = matches.length
    ? matches
        .map(
          (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="pickReportStudent('${s.id}')">
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

function pickReportStudent(studentId) {
  reportSelectedStudentId = studentId;
  document.getElementById("report-student-search-results").style.display = "none";
  document.getElementById("report-student-search").value = "";
  renderReportScopeChip();
  generateReport();
}

function clearReportStudent() {
  reportSelectedStudentId = null;
  renderReportScopeChip();
  generateReport();
}

function renderReportScopeChip() {
  const wrap = document.getElementById("report-selected-student-chip");
  if (!reportSelectedStudentId) {
    wrap.innerHTML = `<span class="badge bg-secondary">Scope: All Students</span>`;
    return;
  }
  const s = reportsStudents.find((x) => x.id === reportSelectedStudentId);
  wrap.innerHTML = `
    <div class="selected-student-chip">
      <div>
        <span class="text-muted small me-1">Scope:</span>
        <strong>${escapeHtml(s ? s.fullName : "Unknown student")}</strong>
        ${s ? `<span class="text-muted small ms-2">${escapeHtml(s.email)}</span>` : ""}
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearReportStudent()">
        <i class="bi bi-arrow-repeat me-1"></i>Show all students
      </button>
    </div>`;
}

async function generateReport() {
  const type = document.getElementById("report-type").value;
  const out = document.getElementById("report-output");
  out.innerHTML = `<div class="text-muted small">Generating...</div>`;

  const [studentsSnap, subjectsSnap, assignSnap, creditSnap] = await Promise.all([
    db.collection("students").get(),
    db.collection("subjects").get(),
    db.collection("studentSubjects").get(),
    db.collection("creditedSubjects").get()
  ]);

  let students = studentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const subjects = {};
  subjectsSnap.forEach((d) => (subjects[d.id] = d.data()));
  let assignments = assignSnap.docs.map((d) => d.data());
  let creditedSubjects = creditSnap.docs.map((d) => d.data());

  // Scope everything down to the selected student, if any. This keeps all
  // three report types - summary, assignments, credits - consistent about
  // what "the report" currently covers.
  const scopedStudent = reportSelectedStudentId ? students.find((s) => s.id === reportSelectedStudentId) : null;
  if (scopedStudent) {
    students = [scopedStudent];
    assignments = assignments.filter((a) => a.studentId === scopedStudent.id);
    creditedSubjects = creditedSubjects.filter((c) => c.studentId === scopedStudent.id);
  }

  const graduatedCount = students.filter((s) => s.status === "Graduated").length;
  const inProgressCount = students.filter((s) => s.status === "In Progress").length;
  const pendingCount = students.length - graduatedCount - inProgressCount;

  const scopeLabel = scopedStudent
    ? `Scope: ${escapeHtml(scopedStudent.fullName)} (${escapeHtml(scopedStudent.email)})`
    : "Scope: All Students";

  const header = `
    <div class="report-header text-center mb-4">
      <h4 class="mb-0">Nexus Integrative University</h4>
      <div class="text-muted">Student Subject Evaluation Management System</div>
      <div class="text-muted">Official System Report</div>
      <hr/>
      <div class="d-flex justify-content-between small text-muted">
        <span>Date Generated: ${new Date().toLocaleString()}</span>
        <span>Generated By: ${escapeHtml(reportsProfile.fullName || reportsProfile.email)} (Admin)</span>
      </div>
      <div class="small fw-semibold mt-1">${scopeLabel}</div>
    </div>`;

  let body = "";

  if (type === "summary") {
    body = `
      <div class="row g-3 mb-4">
        ${[
          [scopedStudent ? "Student" : "Total Students", scopedStudent ? 1 : students.length],
          ["Graduated Students", graduatedCount],
          ["In Progress", inProgressCount],
          ["Pending Students", pendingCount],
          ["Total Subjects", subjectsSnap.size],
          [scopedStudent ? "Credited Subjects" : "Total Credited Subjects", creditedSubjects.length]
        ]
          .map(([label, val]) => `<div class="col"><div class="border rounded p-3 text-center"><div class="small text-muted">${label}</div><h4 class="mb-0">${val}</h4></div></div>`)
          .join("")}
      </div>
      <table class="table table-bordered table-sm">
        <thead><tr><th>Full Name</th><th>Email</th><th>Track</th><th>Year</th><th>Status</th></tr></thead>
        <tbody>${students
          .map((s) => `<tr><td>${escapeHtml(s.fullName)}</td><td>${escapeHtml(s.email)}</td><td>${escapeOrDash(s.track)}</td><td>${escapeHtml(s.yearLevel)}</td><td>${escapeHtml(s.status || "Pending")}</td></tr>`)
          .join("")}</tbody>
      </table>`;
  } else if (type === "assignments") {
    body = assignments.length
      ? `
      <table class="table table-bordered table-sm">
        <thead><tr><th>Student Name</th><th>Subject Code</th><th>Subject Name</th><th>Assigned At</th></tr></thead>
        <tbody>${assignments
          .map((a) => {
            const s = students.find((st) => st.id === a.studentId);
            const sub = subjects[a.subjectId];
            return `<tr><td>${escapeHtml(s ? s.fullName : "?")}</td><td>${escapeHtml(sub ? sub.subjectCode : "?")}</td><td>${escapeHtml(sub ? sub.subjectName : "?")}</td><td>${formatDate(a.assignedAt)}</td></tr>`;
          })
          .join("")}</tbody>
      </table>`
      : `<div class="text-muted text-center py-4">No subject assignments${scopedStudent ? " for this student" : ""} yet.</div>`;
  } else if (type === "credits") {
    body = creditedSubjects.length
      ? `
      <table class="table table-bordered table-sm">
        <thead><tr><th>Student Name</th><th>Subject</th><th>Credited From</th><th>Credited By</th><th>Date</th></tr></thead>
        <tbody>${creditedSubjects
          .map((c) => {
            const s = students.find((st) => st.id === c.studentId);
            const sub = subjects[c.subjectId];
            return `<tr><td>${escapeHtml(s ? s.fullName : "?")}</td><td>${escapeHtml(sub ? sub.subjectCode : "?")}</td><td>${escapeHtml(c.creditedFrom)}</td><td>${escapeHtml(c.creditedBy)}</td><td>${formatDate(c.creditedAt)}</td></tr>`;
          })
          .join("")}</tbody>
      </table>`
      : `<div class="text-muted text-center py-4">No credited subjects${scopedStudent ? " for this student" : ""} yet.</div>`;
  }

  out.innerHTML = `<div class="table-responsive-card">${header}${body}</div>`;
}
