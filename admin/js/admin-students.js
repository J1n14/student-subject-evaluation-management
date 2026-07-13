let allStudents = [];
let studentsPage = 1;
const STUDENTS_PAGE_SIZE = 8;

async function initAdminStudents(content) {
  content.innerHTML = `
    <div class="section-card">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="d-flex gap-2 flex-wrap">
          <input type="text" class="form-control" style="width:220px" placeholder="Search name, ID, or email" id="search-input" />
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
        </div>
        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#studentModal" onclick="openStudentModal()">
          <i class="bi bi-plus-lg me-1"></i>Add Student
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr><th>Student ID</th><th>Full Name</th><th>Email</th><th>Source College</th><th>Course</th><th>Curriculum</th><th>Track</th><th>Year</th><th>Status</th><th class="text-end">Actions</th></tr>
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
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="studentModalTitle">Add Student</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="student-form" class="needs-validation" novalidate>
            <div class="modal-body">
              <input type="hidden" id="studentDocId" />
              <div class="mb-3">
                <label class="form-label">Student ID</label>
                <input type="text" class="form-control" id="studentId" required minlength="6" />
                <div class="form-text" id="studentIdHelp">Also used as the student's initial login password (min. 6 characters).</div>
                <div class="invalid-feedback">Student ID is required and must be at least 6 characters.</div>
              </div>
              <div class="row">
                <div class="col-6 mb-3">
                  <label class="form-label">First Name</label>
                  <input type="text" class="form-control" id="firstName" required />
                  <div class="invalid-feedback">First name is required.</div>
                </div>
                <div class="col-6 mb-3">
                  <label class="form-label">Last Name</label>
                  <input type="text" class="form-control" id="lastName" required />
                  <div class="invalid-feedback">Last name is required.</div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="email" required />
                <div class="invalid-feedback">Valid email is required.</div>
              </div>
              <div class="row">
                <div class="col-6 mb-3">
                  <label class="form-label">Source College</label>
                  <input type="text" class="form-control" id="college" placeholder="e.g. College of Computer Studies" required />
                  <div class="invalid-feedback">Source college is required.</div>
                </div>
                <div class="col-6 mb-3">
                  <label class="form-label">Course</label>
                  <input type="text" class="form-control" id="course" placeholder="e.g. BSIT" required />
                  <div class="invalid-feedback">Course is required.</div>
                </div>
              </div>
              <div class="row">
                <div class="col-6 mb-3">
                  <label class="form-label">Curriculum</label>
                  <select class="form-select" id="curriculum" required>
                    <option value="">Select</option>
                    <option value="Old">Old Curriculum</option>
                    <option value="New">New Curriculum</option>
                  </select>
                  <div class="invalid-feedback">Select a curriculum.</div>
                </div>
                <div class="col-6 mb-3">
                  <label class="form-label">Track</label>
                  <select class="form-select" id="track" required>
                    <option value="">Select</option>
                    <option>Network Technology</option>
                    <option>Service Management</option>
                    <option>Business Analytics</option>
                  </select>
                  <div class="invalid-feedback">Select a track.</div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Year Level</label>
                <select class="form-select" id="yearLevel" required>
                  <option value="">Select</option>
                  <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                </select>
                <div class="invalid-feedback">Select a year level.</div>
              </div>
              <div class="mb-3" id="statusFieldWrap" style="display:none">
                <label class="form-label">Status</label>
                <select class="form-select" id="status">
                  <option value="Pending">Pending</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Graduated">Graduated</option>
                </select>
                <div class="form-text">Status is normally set automatically from Credit Evaluation progress.</div>
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
  document.getElementById("search-input").addEventListener("input", debounce(() => { studentsPage = 1; renderStudentsTable(); }, 250));
  document.getElementById("filter-track").addEventListener("change", () => { studentsPage = 1; renderStudentsTable(); });
  document.getElementById("filter-status").addEventListener("change", () => { studentsPage = 1; renderStudentsTable(); });

  await loadStudents();
}

async function loadStudents() {
  const snap = await db.collection("students").orderBy("createdAt", "desc").get();
  allStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderStudentsTable();
}

function renderStudentsTable() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const trackFilter = document.getElementById("filter-track").value;
  const statusFilter = document.getElementById("filter-status").value;

  let filtered = allStudents.filter((s) => {
    const matchesSearch =
      !search ||
      (s.fullName || "").toLowerCase().includes(search) ||
      (s.id || "").toLowerCase().includes(search) ||
      (s.email || "").toLowerCase().includes(search);
    const matchesTrack = !trackFilter || s.track === trackFilter;
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesTrack && matchesStatus;
  });

  const { pageItems, totalPages, total } = paginate(filtered, studentsPage, STUDENTS_PAGE_SIZE);

  document.getElementById("students-tbody").innerHTML = pageItems.length
    ? pageItems
        .map(
          (s) => `
    <tr>
      <td>${escapeHtml(s.id)}</td>
      <td>${escapeHtml(s.fullName)}</td>
      <td>${escapeHtml(s.email)}</td>
      <td>${escapeOrDash(s.college)}</td>
      <td>${escapeOrDash(s.course)}</td>
      <td>${escapeOrDash(s.curriculum)}</td>
      <td>${escapeOrDash(s.track)}</td>
      <td>${escapeHtml(s.yearLevel)}</td>
      <td>${statusBadge(s.status || "Pending")}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-secondary" onclick="viewStudent('${s.id}')"><i class="bi bi-eye"></i></button>
        <button class="btn btn-sm btn-outline-primary" onclick="openStudentModal('${s.id}')" data-bs-toggle="modal" data-bs-target="#studentModal"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteStudent('${s.id}')"><i class="bi bi-trash"></i></button>
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
  document.getElementById("studentId").disabled = false;
  document.getElementById("studentIdHelp").style.display = "block";

  if (id) {
    const s = allStudents.find((x) => x.id === id);
    document.getElementById("studentModalTitle").textContent = "Edit Student";
    document.getElementById("studentDocId").value = id;
    document.getElementById("studentId").value = s.id;
    document.getElementById("studentId").disabled = true; // ID is the doc key, don't allow changing
    document.getElementById("studentIdHelp").style.display = "none"; // editing never touches the login password
    const [fallbackFirst, ...fallbackRest] = (s.fullName || "").split(" ");
    document.getElementById("firstName").value = s.firstName || fallbackFirst || "";
    document.getElementById("lastName").value = s.lastName || fallbackRest.join(" ") || "";
    document.getElementById("email").value = s.email || "";
    document.getElementById("college").value = s.college || "";
    document.getElementById("course").value = s.course || "";
    document.getElementById("curriculum").value = s.curriculum || "";
    document.getElementById("track").value = s.track || "";
    document.getElementById("yearLevel").value = s.yearLevel || "";
    document.getElementById("status").value = s.status || "Pending";
    document.getElementById("statusFieldWrap").style.display = "block";
  } else {
    document.getElementById("studentModalTitle").textContent = "Add Student";
  }
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

async function saveStudent(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const editingId = document.getElementById("studentDocId").value;
  const studentId = document.getElementById("studentId").value.trim();
  const btn = document.getElementById("student-save-btn");
  btn.disabled = true;

  try {
    const firstName = document.getElementById("firstName").value.trim();
    const lastName = document.getElementById("lastName").value.trim();
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
      updatedAt: serverTimestamp()
    };

    if (editingId) {
      data.status = document.getElementById("status").value;
      await db.collection("students").doc(editingId).update(data);
      await logActivity(`Updated student ${editingId}`);
      showToast("Student updated.");
    } else {
      const existing = await db.collection("students").doc(studentId).get();
      if (existing.exists) throw new Error("A student with this Student ID already exists.");

      // Create the student's login account up front (email + Student ID as password).
      const uid = await createStudentAuthAccount(data.email, studentId);

      data.status = "Pending";
      data.createdAt = serverTimestamp();
      data.uid = uid;
      await db.collection("students").doc(studentId).set(data);
      await db.collection("users").doc(uid).set({
        role: "student",
        email: data.email,
        fullName: data.fullName,
        studentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await logActivity(`Added student ${studentId}`);
      showToast("Student added. They can log in with their email and Student ID as the password.");
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
      <dt class="col-5">Student ID</dt><dd class="col-7">${escapeHtml(s.id)}</dd>
      <dt class="col-5">First Name</dt><dd class="col-7">${escapeHtml(s.firstName)}</dd>
      <dt class="col-5">Last Name</dt><dd class="col-7">${escapeHtml(s.lastName)}</dd>
      <dt class="col-5">Email</dt><dd class="col-7">${escapeHtml(s.email)}</dd>
      <dt class="col-5">Source College</dt><dd class="col-7">${escapeOrDash(s.college)}</dd>
      <dt class="col-5">Course</dt><dd class="col-7">${escapeOrDash(s.course)}</dd>
      <dt class="col-5">Curriculum</dt><dd class="col-7">${escapeOrDash(s.curriculum)}</dd>
      <dt class="col-5">Track</dt><dd class="col-7">${escapeOrDash(s.track)}</dd>
      <dt class="col-5">Year Level</dt><dd class="col-7">${escapeHtml(s.yearLevel)}</dd>
      <dt class="col-5">Status</dt><dd class="col-7">${statusBadge(s.status || "Pending")}</dd>
      <dt class="col-5">Created At</dt><dd class="col-7">${formatDateTime(s.createdAt)}</dd>
      <dt class="col-5">Updated At</dt><dd class="col-7">${formatDateTime(s.updatedAt)}</dd>
    </dl>`;
  new bootstrap.Modal(document.getElementById("viewStudentModal")).show();
}

async function deleteStudent(id) {
  if (!confirm(`Delete student ${id}? This also removes their subject assignments and credited subjects.`)) return;
  try {
    const student = allStudents.find((s) => s.id === id);
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
    await logActivity(`Deleted student ${id}`);
    showToast("Student deleted.");
    await loadStudents();
  } catch (err) {
    showError(err, "Failed to delete student.");
  }
}
