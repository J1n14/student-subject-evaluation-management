let studentSubjectsUnsub = null;

async function initStudentSubjects(content, profile) {
  content.innerHTML = `
    <div class="table-responsive-card">
      <h6 class="mb-3"><i class="bi bi-journal-bookmark me-1"></i>My Assigned Subjects</h6>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Units</th><th>Semester</th></tr></thead>
          <tbody id="my-subjects-tbody"><tr><td colspan="4" class="text-center text-muted py-3">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>`;

  // Real-time updates: newly assigned subjects appear automatically.
  if (studentSubjectsUnsub) studentSubjectsUnsub();
  studentSubjectsUnsub = db
    .collection("studentSubjects")
    .where("studentId", "==", profile.studentId)
    .onSnapshot(
      async (snap) => {
        try {
          if (snap.empty) {
            document.getElementById("my-subjects-tbody").innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No subjects assigned yet.</td></tr>`;
            return;
          }
          const subjectIds = snap.docs.map((d) => d.data().subjectId);
          const subjects = await Promise.all(subjectIds.map((id) => db.collection("subjects").doc(id).get()));
          document.getElementById("my-subjects-tbody").innerHTML = subjects
            .filter((s) => s.exists)
            .map((s) => {
              const d = s.data();
              return `<tr><td>${escapeHtml(d.subjectCode)}</td><td>${escapeHtml(d.subjectName)}</td><td>${escapeHtml(d.units)}</td><td>${escapeHtml(d.semester)}</td></tr>`;
            })
            .join("");
        } catch (err) {
          console.error(err);
          const tbody = document.getElementById("my-subjects-tbody");
          if (tbody) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">
              <i class="bi bi-exclamation-octagon me-1"></i>Couldn't load your subject details.
            </td></tr>`;
          }
          showError(err, "Failed to load your subjects.");
        }
      },
      (err) => {
        // Fires on permission-denied, missing index, or connection failure -
        // without this, onSnapshot fails completely silently and the table
        // stays stuck on "Loading..." forever.
        console.error(err);
        const tbody = document.getElementById("my-subjects-tbody");
        if (tbody) {
          tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-octagon me-1"></i>Couldn't load your subjects. <a href="#" onclick="location.reload();return false;">Retry</a>
          </td></tr>`;
        }
        showError(err, "Failed to load your subjects.");
      }
    );
}