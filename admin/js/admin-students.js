let allStudents = [];
let studentsPage = 1;
const STUDENTS_PAGE_SIZE = 8;

async function initAdminStudents(content) {
  content.innerHTML = `
    <div class="section-card">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="d-flex gap-2 flex-wrap">
          <input type="text" class="form-control" style="width:220px" placeholder="Search by name or email" id="search-input" />
          <select class="form-select" style="width:190px" id="filter-track">
            <option value="">All Tracks</option>
            <option>Network Technology</option>
            <option>Service Management</option>
            <option>Business Analytics</option>
          </select>
          <select class="form-select" style="width:150px" id="filter-status">
            <option value="">All Status</option>
            <option value="Graduated">Graduated</option>
            <option value="In Progress">In Progress</option>
            <option value="Pending">Pending</option>
          </select>
          <select class="form-select" style="width:140px" id="filter-type">
            <option value="">All Type</option>
          </select>
        </div>
        <button
          class="btn"
          data-bs-toggle="modal"
          data-bs-target="#studentModal"
          onclick="openStudentModal()"
          style="background-color:#E4D9FF; border-color:#E4D9FF; color:#273469;"
        >
          <i class="bi bi-plus-lg me-1"></i>Add Student
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr><th>Full Name</th><th>Email</th><th>Source College</th><th>Course</th><th>Curriculum</th><th>Track</th><th>Year</th><th>Type</th><th>Status</th><th class="text-end sticky-col-end">Actions</th></tr>
          </thead>
          <tbody id="students-tbody"></tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <span class="text-muted small" id="students-count"></span>
        <div id="students-pagination"></div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div class="modal fade" id="studentModal" tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="studentModalTitle">Add Student</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="student-form" class="needs-validation" novalidate>
            <div class="modal-body">
              <input type="hidden" id="studentDocId" />
              <div class="alert alert-light border small mb-3" id="newStudentIdNotice">
                <i class="bi bi-info-circle me-1"></i>The student's initial login password will be their
                <strong>Last Name</strong> (padded if shorter than 6 characters).
              </div>

              <div class="mb-4 p-3 border rounded" style="background:var(--bg-soft)">
                <label class="form-label fw-semibold mb-1">
                  <span class="badge bg-primary rounded-pill me-1">1</span>Student Type &mdash; select this first
                </label>
                <div class="text-muted small mb-2">This determines which subjects will need to be assigned later on the Subject Assignment page.</div>
                <select class="form-select" id="studentType" required>
                  <option value="">Select the student type first...</option>
                  <option>Regular</option>
                  <option>Irregular</option>
                  <option>Returnee</option>
                  <option>Transferee</option>
                  <option>Failed</option>
                </select>
                <div class="form-text" id="studentTypeHelp">Choose a type to see what it means for this student's subjects.</div>
                <div class="invalid-feedback">Select a student type.</div>
                <div class="row mt-3" id="previousSubjectCheckWrap" style="display:none">
                  <div class="col-md-6 mb-3">
                    <label class="form-label">Passed all previous subjects?</label>
                    <select class="form-select" id="passedAllPreviousSubjects">
                      <option value="">Select</option>
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                    <div class="invalid-feedback">Please confirm whether the student passed previous subjects.</div>
                  </div>
                  <div class="col-md-6 mb-3" id="failedSubjectsWrap" style="display:none">
                    <label class="form-label">Failed subject codes</label>
                    <div class="input-group mb-2">
                      <input type="text" class="form-control" id="failedSubjectInput" placeholder="Enter a subject code and press Add" />
                      <button type="button" class="btn btn-outline-secondary" id="addFailedSubjectBtn" onclick="addSubjectCode('failedSubjectCodes','failedSubjectInput','failedSubjectList')">Add</button>
                    </div>
                    <div id="failedSubjectList" class="d-flex flex-wrap gap-2"></div>
                    <input type="hidden" id="failedSubjectCodes" />
                    <div class="form-text">Enter subjects the student did not pass so they are not auto-credited.</div>
                  </div>
                </div>
                <div class="mb-3" id="passedSubjectsWrap" style="display:none">
                  <label class="form-label">Passed subject codes</label>
                  <div class="input-group mb-2">
                    <input type="text" class="form-control" id="passedSubjectInput" placeholder="Enter a subject code and press Add" />
                    <button type="button" class="btn btn-outline-secondary" id="addPassedSubjectBtn" onclick="addSubjectCode('passedSubjectCodes','passedSubjectInput','passedSubjectList')">Add</button>
                  </div>
                  <div id="passedSubjectList" class="d-flex flex-wrap gap-2"></div>
                  <input type="hidden" id="passedSubjectCodes" />
                  <div class="form-text">Enter subjects the student already passed manually, so they can be treated as completed during evaluation.</div>
                </div>
                <div class="mb-3" id="transferredSubjectsWrap" style="display:none">
                  <label class="form-label">Transferred subject/course codes</label>
                  <div class="input-group mb-2">
                    <input type="text" class="form-control" id="transferredSubjectInput" placeholder="Enter a subject code and press Add" />
                    <button type="button" class="btn btn-outline-secondary" id="addTransferredSubjectBtn" onclick="addSubjectCode('transferredSubjectCodes','transferredSubjectInput','transferredSubjectList')">Add</button>
                  </div>
                  <div id="transferredSubjectList" class="d-flex flex-wrap gap-2"></div>
                  <input type="hidden" id="transferredSubjectCodes" />
                  <div class="form-text">Enter subject codes from the student's previous school where the code matches but the name may differ. These can be reviewed in Course Matches for approved crediting.</div>
                </div>
                <div class="alert alert-light border small mt-2 mb-0" id="studentTypeAssignNote" style="display:none">
                  <i class="bi bi-signpost-split me-1"></i><span id="studentTypeAssignNoteText"></span>
                </div>
              </div>

              <h6 class="text-uppercase text-muted small fw-bold mb-2" style="letter-spacing:.05em">
                <i class="bi bi-person me-1"></i>Personal Information
              </h6>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">First Name</label>
                  <input type="text" class="form-control" id="firstName" required />
                  <div class="invalid-feedback">First name is required.</div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Last Name</label>
                  <input type="text" class="form-control" id="lastName" required />
                  <div class="invalid-feedback">Last name is required.</div>
                </div>
                <div class="col-12 mb-3">
                  <label class="form-label">Email</label>
                  <input type="email" class="form-control" id="email" required />
                  <div class="invalid-feedback">Valid email is required.</div>
                </div>
              </div>

              <h6 class="text-uppercase text-muted small fw-bold mb-2 mt-1" style="letter-spacing:.05em">
                <i class="bi bi-mortarboard me-1"></i>Academic Background
              </h6>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Source College</label>
                  <input type="text" class="form-control" id="college" placeholder="e.g. College of Computer Studies" required />
                  <div class="invalid-feedback">Source college is required.</div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Course</label>
                  <input type="text" class="form-control" id="course" placeholder="e.g. BSIT" required />
                  <div class="invalid-feedback">Course is required.</div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Curriculum</label>
                  <select class="form-select" id="curriculum" required>
                    <option value="">Select</option>
                    <option value="Old">Old Curriculum</option>
                    <option value="New">New Curriculum</option>
                  </select>
                  <div class="invalid-feedback">Select a curriculum.</div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Track <span class="text-muted fw-normal">(optional)</span></label>
                  <select class="form-select" id="track">
                    <option value="">None / not applicable</option>
                    <option>Network Technology</option>
                    <option>Service Management</option>
                    <option>Business Analytics</option>
                  </select>
                  <div class="invalid-feedback">Track is required for Old Curriculum students.</div>
                </div>
              </div>

              <h6 class="text-uppercase text-muted small fw-bold mb-2 mt-1" style="letter-spacing:.05em">
                <i class="bi bi-calendar-event me-1"></i>Enrollment Details
              </h6>
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">Year Level</label>
                  <select class="form-select" id="yearLevel" required>
                    <option value="">Select</option>
                    <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                  </select>
                  <div class="invalid-feedback">Select a year level.</div>
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Academic Year</label>
                  <input type="text" class="form-control" id="academicYear" placeholder="e.g. 2025-2026" required />
                  <div class="invalid-feedback">Academic year is required.</div>
                </div>
                <div class="col-md-6 mb-3" id="lastSchoolYearWrap" style="display:none">
                  <label class="form-label">Last School Year Attended</label>
                  <input type="text" class="form-control" id="lastSchoolYearAttended" placeholder="e.g. 2023-2024" />
                  <div class="invalid-feedback">Required for this student type.</div>
                </div>
                <div class="col-md-6 mb-3" id="previousSchoolWrap" style="display:none">
                  <label class="form-label">Previous School</label>
                  <input type="text" class="form-control" id="previousSchool" placeholder="School the student transferred from" />
                  <div class="invalid-feedback">Required for transferees.</div>
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label class="form-label">GPA</label>
                  <input type="number" step="0.01" min="0" max="5" class="form-control" id="gpa" placeholder="e.g. 3.25" />
                </div>
                <div class="col-md-6 mb-3">
                  <label class="form-label">Academic Standing</label>
                  <select class="form-select" id="academicStanding">
                    <option value="">None</option>
                    <option>Good Standing</option>
                    <option>Probation</option>
                  </select>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Academic Hold</label>
                <select class="form-select" id="academicHold">
                  <option value="">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>
              <div id="statusFieldWrap" style="display:none">
                <h6 class="text-uppercase text-muted small fw-bold mb-2 mt-1" style="letter-spacing:.05em">
                  <i class="bi bi-flag me-1"></i>Status
                </h6>
                <div class="mb-1">
                  <select class="form-select" id="status">
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Graduated">Graduated</option>
                  </select>
                  <div class="form-text">Status is normally set automatically from Credit Evaluation progress.</div>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="student-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- View Modal -->
    <div class="modal fade" id="viewStudentModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Student Details</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body" id="viewStudentBody"></div>
        </div>
      </div>
    </div>`;

  document.getElementById("student-form").addEventListener("submit", saveStudent);
  document.getElementById("studentType").addEventListener("change", updateStudentTypeFields);
  document.getElementById("passedAllPreviousSubjects").addEventListener("change", updateStudentTypeFields);
  document.getElementById("curriculum").addEventListener("change", updateTrackRequirement);
  document.getElementById("search-input").addEventListener("input", debounce(() => { studentsPage = 1; renderStudentsTable(); }, 250));
  document.getElementById("filter-track").addEventListener("change", () => { studentsPage = 1; renderStudentsTable(); });
  document.getElementById("filter-status").addEventListener("change", () => { studentsPage = 1; renderStudentsTable(); });
  document.getElementById("filter-type").addEventListener("change", () => { studentsPage = 1; renderStudentsTable(); });

  await loadStudents();
}

// Old curriculum has real track electives (Network Technology / Business
// Analytics / Service Management) - leaving Track blank for an Old-curriculum
// student makes getRequiredSubjects() silently skip those subjects entirely,
// which can let a student "Graduate" without ever taking their electives.
// New curriculum has no track split, so Track stays optional there.
function updateTrackRequirement() {
  const curriculum = document.getElementById("curriculum").value;
  const trackInput = document.getElementById("track");
  trackInput.required = curriculum === "Old";
}

// Student Type drives which extra fields apply:
//  - Regular / Irregular: no admission-history fields needed.
//  - Returnee / Failed: needs Last School Year Attended.
//  - Transferee: needs Last School Year Attended + Previous School.
function updateStudentTypeFields() {
  const type = document.getElementById("studentType").value;
  const needsLastYear = ["Returnee", "Transferee", "Failed"].includes(type);
  const needsPrevSchool = type === "Transferee";
  const hasPreviousSubjectCheck = ["Regular", "Irregular", "Failed"].includes(type);
  const hasPassedSubjectEntry = ["Irregular", "Transferee", "Returnee"].includes(type);

  const lastYearWrap = document.getElementById("lastSchoolYearWrap");
  const lastYearInput = document.getElementById("lastSchoolYearAttended");
  lastYearWrap.style.display = needsLastYear ? "block" : "none";
  lastYearInput.required = needsLastYear;
  if (!needsLastYear) lastYearInput.value = "";

  const prevSchoolWrap = document.getElementById("previousSchoolWrap");
  const prevSchoolInput = document.getElementById("previousSchool");
  prevSchoolWrap.style.display = needsPrevSchool ? "block" : "none";
  prevSchoolInput.required = needsPrevSchool;
  if (!needsPrevSchool) prevSchoolInput.value = "";

  const previousSubjectCheckWrap = document.getElementById("previousSubjectCheckWrap");
  const passedAllPreviousSubjects = document.getElementById("passedAllPreviousSubjects");
  const failedSubjectsWrap = document.getElementById("failedSubjectsWrap");
  const failedSubjectsInput = document.getElementById("failedSubjectCodes");

  previousSubjectCheckWrap.style.display = hasPreviousSubjectCheck ? "flex" : "none";
  passedAllPreviousSubjects.required = hasPreviousSubjectCheck;
  if (!hasPreviousSubjectCheck) {
    passedAllPreviousSubjects.value = "";
    failedSubjectsWrap.style.display = "none";
    failedSubjectsInput.value = "";
  }

  const showFailedSubjects = hasPreviousSubjectCheck && passedAllPreviousSubjects.value === "No";
  failedSubjectsWrap.style.display = showFailedSubjects ? "block" : "none";
  failedSubjectsInput.required = showFailedSubjects;
  if (!showFailedSubjects) failedSubjectsInput.value = "";

  const passedSubjectsWrap = document.getElementById("passedSubjectsWrap");
  const passedSubjectsInput = document.getElementById("passedSubjectCodes");
  const transferredSubjectsWrap = document.getElementById("transferredSubjectsWrap");
  const transferredSubjectsInput = document.getElementById("transferredSubjectCodes");

  passedSubjectsWrap.style.display = hasPassedSubjectEntry ? "block" : "none";
  passedSubjectsInput.required = false;
  if (!hasPassedSubjectEntry) passedSubjectsInput.value = "";

  transferredSubjectsWrap.style.display = type === "Transferee" ? "block" : "none";
  transferredSubjectsInput.required = type === "Transferee";
  if (type !== "Transferee") transferredSubjectsInput.value = "";

  document.getElementById("studentTypeHelp").textContent =
    type === "Regular"
      ? "Regular: subjects up to the selected Year Level are auto-credited as already taken, except any failed lower-year subjects you list below."
      : type === "Transferee"
      ? "Transferee: no subjects are auto-credited. Enter the subjects that transferred in from their previous school below."
      : type === "Irregular"
      ? "Irregular: no subjects are auto-credited. If the student failed any subjects, enter them below so they are not auto-credited."
      : type === "Failed"
      ? "Failed: no subjects are auto-credited. Enter the subject codes the student did not pass below."
      : type === "Returnee"
      ? "Returnee: no subjects are auto-credited. Assign only the subjects this student hasn't already taken, watching for unmet prerequisites."
      : "";

  const noteWrap = document.getElementById("studentTypeAssignNote");
  const noteText = document.getElementById("studentTypeAssignNoteText");
  const notes = {
    Regular: "Regular: subjects up to the selected Year Level are auto-credited as already taken, except failed subjects you list below.",
    Irregular: "Irregular: no subjects are auto-credited. Enter any failed subject codes below so the system will not credit them automatically.",
    Returnee: "Returnee: no subjects are auto-credited. On the Assign Subjects page, assign only the subjects this student hasn't already taken.",
    Transferee: "Transferee: no subjects are auto-credited. Enter transferred subjects below for manual review.",
    Failed: "Failed: no subjects are auto-credited. Enter the subject codes the student did not pass below."
  };
  if (type && notes[type]) {
    noteText.textContent = notes[type];
    noteWrap.style.display = "block";
  } else {
    noteWrap.style.display = "none";
  }
}

function normalizeSubjectCodes(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  return String(value)
    .split(/[,;\n]+/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function renderSubjectCodeChips(hiddenFieldId, listId) {
  const hidden = document.getElementById(hiddenFieldId);
  const list = document.getElementById(listId);
  if (!hidden || !list) return;
  const codes = normalizeSubjectCodes(hidden.value);
  list.innerHTML = codes
    .map(
      (code) =>
        `<span class="badge bg-secondary d-inline-flex align-items-center" style="font-size:.85rem">
           ${escapeHtml(code)}
           <button type="button" class="btn-close btn-close-white btn-sm ms-2" aria-label="Remove" onclick="removeSubjectCode('${hiddenFieldId}','${listId}', '${escapeHtml(code)}')"></button>
         </span>`
    )
    .join("");
}

function addSubjectCode(hiddenFieldId, inputId, listId) {
  const input = document.getElementById(inputId);
  const hidden = document.getElementById(hiddenFieldId);
  if (!input || !hidden) return;
  const code = (input.value || "").trim();
  if (!code) return;
  const codes = normalizeSubjectCodes(hidden.value);
  if (!codes.includes(code)) {
    codes.push(code);
    hidden.value = codes.join(", ");
    renderSubjectCodeChips(hiddenFieldId, listId);
  }
  input.value = "";
  input.focus();
}

function removeSubjectCode(hiddenFieldId, listId, codeToRemove) {
  const hidden = document.getElementById(hiddenFieldId);
  if (!hidden) return;
  const codes = normalizeSubjectCodes(hidden.value).filter((code) => code !== codeToRemove);
  hidden.value = codes.join(", ");
  renderSubjectCodeChips(hiddenFieldId, listId);
}

async function loadStudents() {
  const snap = await db.collection("students").orderBy("createdAt", "desc").get();
  allStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  populateStudentTypeFilter();
  renderStudentsTable();
}

function populateStudentTypeFilter() {
  const select = document.getElementById("filter-type");
  if (!select) return;

  const currentValue = select.value;
  const types = [...new Set(allStudents.map((s) => s.studentType).filter(Boolean))].sort();

  const options = types.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join("");
  select.innerHTML = `<option value="">All Type</option>${options}`;

  if (currentValue && types.includes(currentValue)) {
    select.value = currentValue;
  } else {
    select.value = "";
  }
}

function renderStudentsTable() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const trackFilter = document.getElementById("filter-track").value;
  const statusFilter = document.getElementById("filter-status").value;
  const typeFilter = document.getElementById("filter-type").value;

  let filtered = allStudents.filter((s) => {
    const matchesSearch =
      !search ||
      (s.fullName || "").toLowerCase().includes(search) ||
      (s.email || "").toLowerCase().includes(search);
    const matchesTrack = !trackFilter || s.track === trackFilter;
    const matchesStatus = !statusFilter || s.status === statusFilter;
    const matchesType = !typeFilter || s.studentType === typeFilter;
    return matchesSearch && matchesTrack && matchesStatus && matchesType;
  });

  const { pageItems, totalPages, total } = paginate(filtered, studentsPage, STUDENTS_PAGE_SIZE);

  document.getElementById("students-tbody").innerHTML = pageItems.length
    ? pageItems
        .map(
          (s) => `
    <tr>
      <td>${escapeHtml(s.fullName)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeOrDash(s.college)}</td>
      <td>${escapeOrDash(s.course)}</td>
      <td>${escapeOrDash(s.curriculum)}</td>
      <td>${escapeOrDash(s.track)}</td>
      <td>${escapeHtml(s.yearLevel)}</td>
      <td>${escapeOrDash(s.studentType)}</td>
      <td>${statusBadge(s.status || "Pending")}</td>
      <td class="text-end sticky-col-end">
        <div class="d-flex gap-1 justify-content-end flex-nowrap">
          <button class="btn btn-sm btn-outline-secondary" title="View details" onclick="viewStudent('${s.id}')"><i class="bi bi-eye"></i></button>
          <button class="btn btn-sm btn-primary" title="Edit student" onclick="openStudentModal('${s.id}')" data-bs-toggle="modal" data-bs-target="#studentModal"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" title="Delete student" onclick="deleteStudent('${s.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="10" class="text-center text-muted py-4">No students found.</td></tr>`;

  document.getElementById("students-count").textContent = `${total} student(s)`;
  renderPagination(document.getElementById("students-pagination"), studentsPage, totalPages, (p) => {
    studentsPage = p;
    renderStudentsTable();
  });
}

function openStudentModal(id) {
  const form = document.getElementById("student-form");
  form.classList.remove("was-validated");
  form.reset();
  document.getElementById("statusFieldWrap").style.display = "none";
  document.getElementById("studentDocId").value = "";

  if (id) {
    const s = allStudents.find((x) => x.id === id);
    document.getElementById("studentModalTitle").textContent = "Edit Student";
    document.getElementById("studentDocId").value = id;

    // Editing an existing student never touches their password.
    document.getElementById("newStudentIdNotice").style.display = "none";

    const [fallbackFirst, ...fallbackRest] = (s.fullName || "").split(" ");
    document.getElementById("firstName").value = s.firstName || fallbackFirst || "";
    document.getElementById("lastName").value = s.lastName || fallbackRest.join(" ") || "";
    document.getElementById("email").value = s.email || "";
    document.getElementById("college").value = s.college || "";
    document.getElementById("course").value = s.course || "";
    document.getElementById("curriculum").value = s.curriculum || "";
    document.getElementById("track").value = s.track || "";
    document.getElementById("yearLevel").value = s.yearLevel || "";
    document.getElementById("studentType").value = s.studentType || "";
    document.getElementById("academicYear").value = s.academicYear || "";
    document.getElementById("lastSchoolYearAttended").value = s.lastSchoolYearAttended || "";
    document.getElementById("previousSchool").value = s.previousSchool || "";
    document.getElementById("passedAllPreviousSubjects").value = s.passedAllPreviousSubjects || "";
    document.getElementById("failedSubjectCodes").value = s.failedSubjectCodes || "";
    document.getElementById("passedSubjectCodes").value = s.passedSubjectCodes || "";
    document.getElementById("transferredSubjectCodes").value = s.transferredSubjectCodes || "";
    renderSubjectCodeChips("failedSubjectCodes", "failedSubjectList");
    renderSubjectCodeChips("passedSubjectCodes", "passedSubjectList");
    renderSubjectCodeChips("transferredSubjectCodes", "transferredSubjectList");
    document.getElementById("gpa").value = s.gpa ?? "";
    document.getElementById("academicStanding").value = s.academicStanding || "";
    document.getElementById("academicHold").value = s.academicHold ? "Yes" : "";
    document.getElementById("status").value = s.status || "Pending";
    document.getElementById("statusFieldWrap").style.display = "block";
    updateStudentTypeFields();
    updateTrackRequirement();
  } else {
    document.getElementById("studentModalTitle").textContent = "Add Student";
    document.getElementById("newStudentIdNotice").style.display = "block";
    updateStudentTypeFields();
    updateTrackRequirement();
  }
}

// Initial login password is the student's Last Name. Firebase requires at
// least 6 characters, so short last names are padded deterministically.
function generateInitialPassword(lastName) {
  const base = (lastName || "").replace(/\s+/g, "");
  if (base.length >= 6) return base;
  return (base + "000000").slice(0, 6);
}

// Creates the student's login account without disturbing the Admin's own
// signed-in session, via a throwaway secondary Firebase App instance.
async function createStudentAuthAccount(email, password) {
  const secondaryApp = firebase.initializeApp(firebaseConfig, "student-create-" + Date.now());
  try {
    const cred = await secondaryApp.auth().createUserWithEmailAndPassword(email, password);
    return cred.user.uid;
  } finally {
    await secondaryApp.delete();
  }
}

// For a Regular student, every subject in their curriculum + track from a
// year level BELOW their current year is treated as already taken, so it is
// written as a credited record. No grades are tracked here — a credit simply
// means "subject already taken". Idempotent: deterministic IDs + merge, so
// re-saving never duplicates and never disturbs credits for the current or
// upper years. Returns how many subjects were credited.
async function autoCreditLowerYears(studentId, student) {
  const currentYearIdx = YEAR_ORDER.indexOf(student.yearLevel);
  if (currentYearIdx <= 0) return 0; // 1st Year (or unknown) has no lower years

  const subjectsSnap = await db.collection("subjects").get();
  const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const failedCodes = new Set((student.failedSubjectCodes || "").split(",").map((c) => c.trim()).filter(Boolean));
  const lowerYear = getRequiredSubjects(student, allSubjects).filter((s) => {
    const idx = YEAR_ORDER.indexOf(s.yearLevel);
    return idx > -1 && idx < currentYearIdx;
  });
  if (lowerYear.length === 0) return 0;

  // Only credit subjects that AREN'T already credited. Without this check,
  // calling this on every edit (not just creation) re-writes creditedAt /
  // creditedBy for every lower-year subject every time - silently corrupting
  // credit history and misleading the "Auto-credited N subject(s)" toast.
  const creditedSnap = await db.collection("creditedSubjects").where("studentId", "==", studentId).get();
  const alreadyCredited = new Set(creditedSnap.docs.map((d) => d.data().subjectId));
  const toCredit = lowerYear.filter((s) => !alreadyCredited.has(s.id) && !failedCodes.has(s.subjectCode));
  if (toCredit.length === 0) return 0;

  const batch = db.batch();
  toCredit.forEach((sub) => {
    const ref = db.collection("creditedSubjects").doc(`${studentId}_${sub.id}`);
    batch.set(
      ref,
      {
        studentId,
        subjectId: sub.id,
        creditedFrom: "Regular - completed in prior year",
        remarks: "Auto-credited (regular)",
        creditedBy: auth.currentUser.email,
        creditedAt: serverTimestamp()
      },
      { merge: true }
    );
  });
  await batch.commit();
  return toCredit.length;
}

async function autoCreditManualPassedSubjects(studentId, student) {
  const passedCodes = normalizeSubjectCodes(student.passedSubjectCodes || "").map((code) => code.toUpperCase());
  if (passedCodes.length === 0) return 0;

  const subjectsSnap = await db.collection("subjects").get();
  const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const requiredSubjects = getRequiredSubjects(student, allSubjects);
  const requiredByCode = requiredSubjects.reduce((map, sub) => {
    const code = (sub.subjectCode || "").trim().toUpperCase();
    if (!code) return map;
    if (!map.has(code)) map.set(code, []);
    map.get(code).push(sub);
    return map;
  }, new Map());

  const matchedSubjects = passedCodes.flatMap((code) => requiredByCode.get(code) || []);
  if (matchedSubjects.length === 0) return 0;

  const creditedSnap = await db.collection("creditedSubjects").where("studentId", "==", studentId).get();
  const alreadyCredited = new Set(creditedSnap.docs.map((d) => d.data().subjectId));
  const toCredit = matchedSubjects.filter((s) => !alreadyCredited.has(s.id));
  if (toCredit.length === 0) return 0;

  const batch = db.batch();
  toCredit.forEach((sub) => {
    const ref = db.collection("creditedSubjects").doc(`${studentId}_${sub.id}`);
    batch.set(
      ref,
      {
        studentId,
        subjectId: sub.id,
        creditedFrom: "Manual passed subject entry",
        remarks: "Auto-credited from manual passed subject list",
        creditedBy: auth.currentUser.email,
        creditedAt: serverTimestamp()
      },
      { merge: true }
    );
  });
  await batch.commit();
  return toCredit.length;
}

async function saveStudent(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const editingId = document.getElementById("studentDocId").value;
  const btn = document.getElementById("student-save-btn");
  btn.disabled = true;

  try {
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
    const studentType = document.getElementById("studentType").value;
    const needsLastYear = ["Returnee", "Transferee", "Failed"].includes(studentType);
    const data = {
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim(),
      email: document.getElementById("email").value.trim(),
      college: document.getElementById("college").value.trim(),
      course: document.getElementById("course").value.trim(),
      curriculum: document.getElementById("curriculum").value,
      track: document.getElementById("track").value,
      yearLevel: document.getElementById("yearLevel").value,
      studentType,
      academicYear: document.getElementById("academicYear").value.trim(),
      passedAllPreviousSubjects: document.getElementById("passedAllPreviousSubjects").value || "",
      failedSubjectCodes: normalizeSubjectCodes(document.getElementById("failedSubjectCodes").value).join(", "),
      passedSubjectCodes: normalizeSubjectCodes(document.getElementById("passedSubjectCodes").value).join(", "),
      transferredSubjectCodes: normalizeSubjectCodes(document.getElementById("transferredSubjectCodes").value).join(", "),
      gpa: document.getElementById("gpa").value === "" ? null : Number(document.getElementById("gpa").value),
      academicStanding: document.getElementById("academicStanding").value || "",
      academicHold: document.getElementById("academicHold").value === "Yes",
      lastSchoolYearAttended: needsLastYear ? document.getElementById("lastSchoolYearAttended").value.trim() : "",
      previousSchool: studentType === "Transferee" ? document.getElementById("previousSchool").value.trim() : "",
      updatedAt: serverTimestamp()
    };

    if (editingId) {
      data.status = document.getElementById("status").value;
      await db.collection("students").doc(editingId).update(data);
      await logActivity(`Updated student ${editingId}`);
      const autoCreditMessages = [];
      if (data.studentType === "Regular") {
        const n = await autoCreditLowerYears(editingId, data);
        if (n) autoCreditMessages.push(`auto-credited ${n} lower-year subject(s)`);
      }
      const m = await autoCreditManualPassedSubjects(editingId, data);
      if (m) autoCreditMessages.push(`credited ${m} manually passed subject(s)`);
      await recomputeCreditStatus(editingId);
      showToast(`Student updated.${autoCreditMessages.length ? ` ${autoCreditMessages.join(", ")}.` : ""}`);
    } else {
      const initialPassword = generateInitialPassword(lastName);

      // Create the student's login account up front (email + Last Name as password).
      const uid = await createStudentAuthAccount(data.email, initialPassword);

      data.status = "Pending";
      data.createdAt = serverTimestamp();
      data.uid = uid;
      // Students are simply enrolled - no record code is assigned. Firestore
      // generates the document's internal ID; nothing user-facing depends on it.
      const studentRef = await db.collection("students").add(data);
      const studentId = studentRef.id;
      await db.collection("users").doc(uid).set({
        role: "student",
        email: data.email,
        fullName: data.fullName,
        studentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await logActivity(`Added student ${data.fullName}`);
      const passwordNote = `They log in with their email and their Last Name ("${initialPassword}") as the password.`;
      const autoCreditMessages = [];
      if (data.studentType === "Regular") {
        const n = await autoCreditLowerYears(studentId, data);
        if (n) autoCreditMessages.push(`auto-credited ${n} lower-year subject(s)`);
      }
      const m = await autoCreditManualPassedSubjects(studentId, data);
      if (m) autoCreditMessages.push(`credited ${m} manually passed subject(s)`);
      await recomputeCreditStatus(studentId);
      showToast(`Student added.${autoCreditMessages.length ? ` ${autoCreditMessages.join(", ")}.` : ""} ${passwordNote}`);
    }

    bootstrap.Modal.getInstance(document.getElementById("studentModal")).hide();
    await loadStudents();
  } catch (err) {
    showError(err, "Failed to save student.");
  } finally {
    btn.disabled = false;
  }
}

function viewStudent(id) {
  const s = allStudents.find((x) => x.id === id);
  document.getElementById("viewStudentBody").innerHTML = `
    <dl class="row mb-0">
      <dt class="col-5">First Name</dt><dd class="col-7">${escapeHtml(s.firstName)}</dd>
      <dt class="col-5">Last Name</dt><dd class="col-7">${escapeHtml(s.lastName)}</dd>
      <dt class="col-5">Email</dt><dd class="col-7">${escapeHtml(s.email)}</dd>
      <dt class="col-5">Source College</dt><dd class="col-7">${escapeOrDash(s.college)}</dd>
      <dt class="col-5">Course</dt><dd class="col-7">${escapeOrDash(s.course)}</dd>
      <dt class="col-5">Curriculum</dt><dd class="col-7">${escapeOrDash(s.curriculum)}</dd>
      <dt class="col-5">Track</dt><dd class="col-7">${escapeOrDash(s.track)}</dd>
      <dt class="col-5">Year Level</dt><dd class="col-7">${escapeHtml(s.yearLevel)}</dd>
      <dt class="col-5">Student Type</dt><dd class="col-7">${escapeOrDash(s.studentType)}</dd>
      <dt class="col-5">Academic Year</dt><dd class="col-7">${escapeOrDash(s.academicYear)}</dd>
      <dt class="col-5">Last School Year Attended</dt><dd class="col-7">${escapeOrDash(s.lastSchoolYearAttended)}</dd>
      <dt class="col-5">Previous School</dt><dd class="col-7">${escapeOrDash(s.previousSchool)}</dd>
      <dt class="col-5">Passed All Previous Subjects</dt><dd class="col-7">${escapeOrDash(s.passedAllPreviousSubjects)}</dd>
      <dt class="col-5">Passed Subject Codes</dt><dd class="col-7">${escapeOrDash(s.passedSubjectCodes)}</dd>
      <dt class="col-5">Failed Subject Codes</dt><dd class="col-7">${escapeOrDash(s.failedSubjectCodes)}</dd>
      <dt class="col-5">Transferred Subject Codes</dt><dd class="col-7">${escapeOrDash(s.transferredSubjectCodes)}</dd>
      <dt class="col-5">Status</dt><dd class="col-7">${statusBadge(s.status || "Pending")}</dd>
      <dt class="col-5">Created At</dt><dd class="col-7">${formatDateTime(s.createdAt)}</dd>
      <dt class="col-5">Updated At</dt><dd class="col-7">${formatDateTime(s.updatedAt)}</dd>
    </dl>`;
  new bootstrap.Modal(document.getElementById("viewStudentModal")).show();
}

async function deleteStudent(id) {
  const student = allStudents.find((s) => s.id === id);
  const name = student ? student.fullName : "this student";
  if (!confirm(`Delete ${name}? This also removes their subject assignments and credited subjects.`)) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection("students").doc(id));
    if (student && student.uid) {
      batch.delete(db.collection("users").doc(student.uid));
    }

    const [assignSnap, creditSnap] = await Promise.all([
      db.collection("studentSubjects").where("studentId", "==", id).get(),
      db.collection("creditedSubjects").where("studentId", "==", id).get()
    ]);
    assignSnap.forEach((d) => batch.delete(d.ref));
    creditSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    await logActivity(`Deleted student ${name}`);
    showToast("Student deleted.");
    await loadStudents();
  } catch (err) {
    showError(err, "Failed to delete student.");
  }
}
