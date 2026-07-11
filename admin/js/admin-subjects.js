let allSubjects = [];
let subjectsPage = 1;
const SUBJECTS_PAGE_SIZE = 8;

async function initAdminSubjects(content) {
  content.innerHTML = `
    <div class="section-card">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div class="d-flex gap-2 flex-wrap">
          <input type="text" class="form-control" style="width:220px" placeholder="Search code or name" id="search-input" />
          <select class="form-select" style="width:130px" id="filter-year">
            <option value="">All Years</option>
            <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
          </select>
          <select class="form-select" style="width:150px" id="filter-semester">
            <option value="">All Semesters</option>
            <option>1st Semester</option><option>2nd Semester</option><option>Midterm</option><option>Summer</option>
          </select>
          <select class="form-select" style="width:140px" id="filter-status">
            <option value="">All Status</option>
            <option>Active</option><option>Inactive</option>
          </select>
        </div>
        <button class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#subjectModal" onclick="openSubjectModal()">
          <i class="bi bi-plus-lg me-1"></i>Add Subject
        </button>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Code</th><th>Subject Name</th><th>Units</th><th>Year</th><th>Semester</th><th>A.Y.</th><th>Status</th><th class="text-end">Actions</th></tr></thead>
          <tbody id="subjects-tbody"></tbody>
        </table>
      </div>
      <div class="d-flex justify-content-between align-items-center">
        <span class="text-muted small" id="subjects-count"></span>
        <div id="subjects-pagination"></div>
      </div>
    </div>

    <div class="modal fade" id="subjectModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="subjectModalTitle">Add Subject</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="subject-form" class="needs-validation" novalidate>
            <div class="modal-body">
              <input type="hidden" id="subjectDocId" />
              <div class="mb-3">
                <label class="form-label">Subject Code</label>
                <input type="text" class="form-control" id="subjectCode" required />
                <div class="invalid-feedback">Subject code is required.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Subject Name</label>
                <input type="text" class="form-control" id="subjectName" required />
                <div class="invalid-feedback">Subject name is required.</div>
              </div>
              <div class="row">
                <div class="col-4 mb-3">
                  <label class="form-label">Units</label>
                  <input type="number" min="1" max="10" class="form-control" id="units" required />
                  <div class="invalid-feedback">Required.</div>
                </div>
                <div class="col-4 mb-3">
                  <label class="form-label">Year Level</label>
                  <select class="form-select" id="yearLevel" required>
                    <option value="">Select</option>
                    <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                  </select>
                  <div class="invalid-feedback">Required.</div>
                </div>
                <div class="col-4 mb-3">
                  <label class="form-label">Semester</label>
                  <select class="form-select" id="semester" required>
                    <option value="">Select</option>
                    <option>1st Semester</option><option>2nd Semester</option><option>Midterm</option><option>Summer</option>
                  </select>
                  <div class="invalid-feedback">Required.</div>
                </div>
              </div>
              <div class="row">
                <div class="col-6 mb-3">
                  <label class="form-label">Academic Year</label>
                  <input type="text" class="form-control" id="academicYear" placeholder="e.g. 2025-2026" required />
                  <div class="invalid-feedback">Required.</div>
                </div>
                <div class="col-6 mb-3">
                  <label class="form-label">Status</label>
                  <select class="form-select" id="status">
                    <option>Active</option><option>Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="subject-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

  document.getElementById("subject-form").addEventListener("submit", saveSubject);
  document.getElementById("search-input").addEventListener("input", debounce(() => { subjectsPage = 1; renderSubjectsTable(); }, 250));
  document.getElementById("filter-year").addEventListener("change", () => { subjectsPage = 1; renderSubjectsTable(); });
  document.getElementById("filter-semester").addEventListener("change", () => { subjectsPage = 1; renderSubjectsTable(); });
  document.getElementById("filter-status").addEventListener("change", () => { subjectsPage = 1; renderSubjectsTable(); });

  await loadSubjects();
}

async function loadSubjects() {
  const snap = await db.collection("subjects").orderBy("createdAt", "desc").get();
  allSubjects = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderSubjectsTable();
}

function renderSubjectsTable() {
  const search = document.getElementById("search-input").value.toLowerCase();
  const yearFilter = document.getElementById("filter-year").value;
  const semFilter = document.getElementById("filter-semester").value;
  const statusFilter = document.getElementById("filter-status").value;

  let filtered = allSubjects.filter((s) => {
    const matchesSearch = !search || (s.subjectCode || "").toLowerCase().includes(search) || (s.subjectName || "").toLowerCase().includes(search);
    const matchesYear = !yearFilter || s.yearLevel === yearFilter;
    const matchesSem = !semFilter || s.semester === semFilter;
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesYear && matchesSem && matchesStatus;
  });

  const { pageItems, totalPages, total } = paginate(filtered, subjectsPage, SUBJECTS_PAGE_SIZE);

  document.getElementById("subjects-tbody").innerHTML = pageItems.length
    ? pageItems
        .map(
          (s) => `
    <tr>
      <td>${escapeHtml(s.subjectCode)}</td>
      <td>${escapeHtml(s.subjectName)}</td>
      <td>${escapeHtml(s.units)}</td>
      <td>${escapeHtml(s.yearLevel)}</td>
      <td>${escapeHtml(s.semester)}</td>
      <td>${escapeHtml(s.academicYear)}</td>
      <td>${statusBadge(s.status || "Active")}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" onclick="openSubjectModal('${s.id}')" data-bs-toggle="modal" data-bs-target="#subjectModal"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteSubject('${s.id}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="8" class="text-center text-muted py-4">No subjects found.</td></tr>`;

  document.getElementById("subjects-count").textContent = `${total} subject(s)`;
  renderPagination(document.getElementById("subjects-pagination"), subjectsPage, totalPages, (p) => {
    subjectsPage = p;
    renderSubjectsTable();
  });
}

function openSubjectModal(id) {
  const form = document.getElementById("subject-form");
  form.classList.remove("was-validated");
  form.reset();
  document.getElementById("subjectDocId").value = "";

  if (id) {
    const s = allSubjects.find((x) => x.id === id);
    document.getElementById("subjectModalTitle").textContent = "Edit Subject";
    document.getElementById("subjectDocId").value = id;
    document.getElementById("subjectCode").value = s.subjectCode || "";
    document.getElementById("subjectName").value = s.subjectName || "";
    document.getElementById("units").value = s.units || "";
    document.getElementById("yearLevel").value = s.yearLevel || "";
    document.getElementById("semester").value = s.semester || "";
    document.getElementById("academicYear").value = s.academicYear || "";
    document.getElementById("status").value = s.status || "Active";
  } else {
    document.getElementById("subjectModalTitle").textContent = "Add Subject";
  }
}

async function saveSubject(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const editingId = document.getElementById("subjectDocId").value;
  const btn = document.getElementById("subject-save-btn");
  btn.disabled = true;

  try {
    const data = {
      subjectCode: document.getElementById("subjectCode").value.trim(),
      subjectName: document.getElementById("subjectName").value.trim(),
      units: Number(document.getElementById("units").value),
      yearLevel: document.getElementById("yearLevel").value,
      semester: document.getElementById("semester").value,
      academicYear: document.getElementById("academicYear").value.trim(),
      status: document.getElementById("status").value,
      updatedAt: serverTimestamp()
    };

    if (editingId) {
      await db.collection("subjects").doc(editingId).update(data);
      await logActivity(`Updated subject ${data.subjectCode}`);
      showToast("Subject updated.");
    } else {
      data.createdAt = serverTimestamp();
      await db.collection("subjects").add(data);
      await logActivity(`Added subject ${data.subjectCode}`);
      showToast("Subject added.");
    }

    bootstrap.Modal.getInstance(document.getElementById("subjectModal")).hide();
    await loadSubjects();
  } catch (err) {
    showError(err, "Failed to save subject.");
  } finally {
    btn.disabled = false;
  }
}

async function deleteSubject(id) {
  const s = allSubjects.find((x) => x.id === id);
  if (!confirm(`Delete subject ${s.subjectCode}? This also removes related assignments and evaluations.`)) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection("subjects").doc(id));

    const [assignSnap, evalSnap] = await Promise.all([
      db.collection("studentSubjects").where("subjectId", "==", id).get(),
      db.collection("evaluations").where("subjectId", "==", id).get()
    ]);
    assignSnap.forEach((d) => batch.delete(d.ref));
    evalSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    await logActivity(`Deleted subject ${s.subjectCode}`);
    showToast("Subject deleted.");
    await loadSubjects();
  } catch (err) {
    showError(err, "Failed to delete subject.");
  }
}
