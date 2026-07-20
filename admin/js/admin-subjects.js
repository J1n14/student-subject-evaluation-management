let allSubjects = [];

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
          <select class="form-select" style="width:180px" id="filter-track">
            <option value="">Any Track</option>
            <option>General</option>
            <option>Network Technology</option>
            <option>Service Management</option>
            <option>Business Analytics</option>
          </select>
          <select class="form-select" style="width:170px" id="filter-curriculum">
            <option value="">Any Curriculum</option>
            <option value="Old">Old Curriculum</option>
            <option value="New">New Curriculum</option>
            <option value="__untagged">Untagged (legacy)</option>
          </select>
          <select class="form-select" style="width:140px" id="filter-status">
            <option value="">All Status</option>
            <option>Active</option><option>Inactive</option>
          </select>
        </div>
        <button
          class="btn"
          data-bs-toggle="modal"
          data-bs-target="#subjectModal"
          onclick="openSubjectModal()"
          style="background-color:#E4D9FF; border-color:#E4D9FF; color:#273469;"
        >
          <i class="bi bi-plus-lg me-1"></i>Add Subject
        </button>
      </div>
      <div class="table-responsive" style="max-height: calc(100vh - 260px); min-height: 300px; overflow-y: auto;">
        <table class="table table-hover table-sm align-middle mb-0">
          <thead class="sticky-top bg-white"><tr><th>Code</th><th>Subject Name</th><th>Units</th><th class="text-nowrap">Year</th><th class="text-nowrap text-center">Track</th><th class="text-nowrap text-center">Curriculum</th><th class="text-nowrap">Prerequisite</th><th class="text-nowrap">Semester</th><th class="text-nowrap">A.Y.</th><th>Status</th><th class="text-end sticky-col-end">Actions</th></tr></thead>
          <tbody id="subjects-tbody"></tbody>
        </table>
      </div>
      <div class="mt-2">
        <span class="text-muted small" id="subjects-count"></span>
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
                <div class="col-6 mb-3">
                  <label class="form-label">Units</label>
                  <input type="number" min="1" max="10" class="form-control" id="units" required />
                  <div class="invalid-feedback">Required.</div>
                </div>
                <div class="col-6 mb-3">
                  <label class="form-label">Year Level</label>
                  <select class="form-select" id="yearLevel" required>
                    <option value="">Select</option>
                    <option>1st Year</option><option>2nd Year</option><option>3rd Year</option><option>4th Year</option>
                  </select>
                  <div class="invalid-feedback">Required.</div>
                </div>
              </div>
              <div class="row">
                <div class="col-6 mb-3">
                  <label class="form-label">Semester</label>
                  <select class="form-select" id="semester" required>
                    <option value="">Select</option>
                    <option>1st Semester</option><option>2nd Semester</option><option>Midterm</option><option>Summer</option>
                  </select>
                  <div class="invalid-feedback">Required.</div>
                </div>
                <div class="col-6 mb-3">
                  <label class="form-label">Track</label>
                  <select class="form-select" id="track" required>
                    <option value="">Select</option>
                    <option>General</option>
                    <option>Network Technology</option>
                    <option>Service Management</option>
                    <option>Business Analytics</option>
                  </select>
                  <div class="invalid-feedback">Required.</div>
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
                  <label class="form-label">Prerequisite</label>
                  <input type="text" class="form-control" id="prerequisite" placeholder="Subject code, e.g. IT301 (optional)" />
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
  document.getElementById("search-input").addEventListener("input", debounce(renderSubjectsTable, 250));
  document.getElementById("filter-year").addEventListener("change", renderSubjectsTable);
  document.getElementById("filter-semester").addEventListener("change", renderSubjectsTable);
  document.getElementById("filter-track").addEventListener("change", renderSubjectsTable);
  document.getElementById("filter-curriculum").addEventListener("change", renderSubjectsTable);
  document.getElementById("filter-status").addEventListener("change", renderSubjectsTable);

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
  const trackFilter = document.getElementById("filter-track").value;
  const curriculumFilter = document.getElementById("filter-curriculum").value;
  const statusFilter = document.getElementById("filter-status").value;

  let filtered = allSubjects.filter((s) => {
    const matchesSearch = !search || (s.subjectCode || "").toLowerCase().includes(search) || (s.subjectName || "").toLowerCase().includes(search);
    const matchesYear = !yearFilter || s.yearLevel === yearFilter;
    const matchesSem = !semFilter || s.semester === semFilter;
    // "General" is the current label for subjects that apply to every track;
    // "All Tracks" is the legacy stored value from before the rename.
    const matchesTrack =
      !trackFilter || s.track === trackFilter || (trackFilter === "General" && s.track === "All Tracks");
    const matchesCurriculum =
      !curriculumFilter || (curriculumFilter === "__untagged" ? !s.curriculum : s.curriculum === curriculumFilter);
    const matchesStatus = !statusFilter || s.status === statusFilter;
    return matchesSearch && matchesYear && matchesSem && matchesTrack && matchesCurriculum && matchesStatus;
  });

  document.getElementById("subjects-tbody").innerHTML = filtered.length
    ? filtered
        .map(
          (s) => `
    <tr>
      <td class="text-nowrap">${escapeHtml(s.subjectCode)}</td>
      <td>${escapeHtml(s.subjectName)}</td>
      <td>${escapeHtml(s.units)}</td>
      <td class="text-nowrap">${escapeHtml(s.yearLevel)}</td>
      <td class="text-nowrap text-center">${escapeOrDash(s.track)}</td>
      <td class="text-nowrap text-center">${escapeOrDash(s.curriculum)}</td>
      <td class="text-nowrap">${escapeOrDash(s.prerequisite)}</td>
      <td class="text-nowrap">${escapeHtml(s.semester)}</td>
      <td class="text-nowrap">${escapeHtml(s.academicYear)}</td>
      <td>${statusBadge(s.status || "Active")}</td>
      <td class="text-end sticky-col-end">
        <div class="d-flex gap-1 justify-content-end flex-nowrap">
          <button class="btn btn-sm btn-primary" title="Edit subject" onclick="openSubjectModal('${s.id}')" data-bs-toggle="modal" data-bs-target="#subjectModal"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" title="Delete subject" onclick="deleteSubject('${s.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </td>
    </tr>`
        )
        .join("")
    : `<tr><td colspan="11" class="text-center text-muted py-4">No subjects found.</td></tr>`;

  document.getElementById("subjects-count").textContent = `${filtered.length} subject(s)`;
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
    // "All Tracks" is the legacy stored value for what the dropdown now
    // calls "General" - map it so editing an old-seeded subject doesn't show
    // a blank Track and silently blank it out on save.
    document.getElementById("track").value = (s.track === "All Tracks" ? "General" : s.track) || "";
    document.getElementById("curriculum").value = s.curriculum || "";
    document.getElementById("prerequisite").value = s.prerequisite || "";
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
      track: document.getElementById("track").value,
      curriculum: document.getElementById("curriculum").value,
      prerequisite: document.getElementById("prerequisite").value.trim(),
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
  if (!confirm(`Delete subject ${s.subjectCode}? This also removes related assignments and credited subjects.`)) return;
  try {
    const batch = db.batch();
    batch.delete(db.collection("subjects").doc(id));

    const [assignSnap, creditSnap] = await Promise.all([
      db.collection("studentSubjects").where("subjectId", "==", id).get(),
      db.collection("creditedSubjects").where("subjectId", "==", id).get()
    ]);
    assignSnap.forEach((d) => batch.delete(d.ref));
    creditSnap.forEach((d) => batch.delete(d.ref));

    await batch.commit();
    await logActivity(`Deleted subject ${s.subjectCode}`);
    showToast("Subject deleted.");
    await loadSubjects();
  } catch (err) {
    showError(err, "Failed to delete subject.");
  }
}
