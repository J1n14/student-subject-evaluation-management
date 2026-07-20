let studentSubjectsUnsub = null;

async function initStudentSubjects(content, profile) {
  content.innerHTML = `
    <div class="table-responsive-card">
      <h6 class="mb-3"><i class="bi bi-journal-bookmark me-1"></i>My Assigned Subjects</h6>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Units</th><th>Semester</th><th></th></tr></thead>
          <tbody id="my-subjects-tbody"><tr><td colspan="5" class="text-center text-muted py-3">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>

    <!-- Subject availability modal -->
    <div class="modal fade" id="subjectAvailabilityModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header"><h5 class="modal-title">Subject Availability</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
          <div class="modal-body" id="subjectAvailabilityBody">Loading...</div>
          <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button></div>
        </div>
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
            document.getElementById("my-subjects-tbody").innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No subjects assigned yet.</td></tr>`;
            return;
          }
          const subjectIds = snap.docs.map((d) => d.data().subjectId);
          const subjects = await Promise.all(subjectIds.map((id) => db.collection("subjects").doc(id).get()));
          document.getElementById("my-subjects-tbody").innerHTML = subjects
            .filter((s) => s.exists)
            .map((s) => s.data())
            .map((d) => {
              return `<tr>
                <td>${escapeHtml(d.subjectCode)}</td>
                <td>${escapeHtml(d.subjectName)}</td>
                <td>${escapeHtml(d.units)}</td>
                <td>${escapeHtml(d.semester)}</td>
                <td class="text-end"><button class="btn btn-sm btn-outline-primary" onclick="viewSubjectAvailability('${escapeHtml(d.subjectCode)}','${d.id}')">View availability</button></td>
              </tr>`;
            })
            .join("");
        } catch (err) {
          console.error(err);
          const tbody = document.getElementById("my-subjects-tbody");
          if (tbody) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">
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
          tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger py-4">
            <i class="bi bi-exclamation-octagon me-1"></i>Couldn't load your subjects. <a href="#" onclick="location.reload();return false;">Retry</a>
          </td></tr>`;
        }
        showError(err, "Failed to load your subjects.");
      }
    );
}

async function viewSubjectAvailability(subjectCode, subjectId) {
  try {
    const modalBody = document.getElementById("subjectAvailabilityBody");
    modalBody.innerHTML = "Loading...";

    const [subjectDoc, studentDoc, creditedSnap, termDoc] = await Promise.all([
      db.collection("subjects").doc(subjectId).get(),
      db.collection("students").doc(auth.currentUser?.studentId || auth.currentUser?.uid).get(),
      db.collection("creditedSubjects").where("studentId", "==", auth.currentUser?.studentId || auth.currentUser?.uid).get(),
      db.collection("settings").doc("currentTerm").get()
    ]);

    if (!subjectDoc.exists) {
      modalBody.innerHTML = `<div class="alert alert-warning small">Subject ${escapeHtml(subjectCode)} not found in catalog.</div>`;
      new bootstrap.Modal(document.getElementById("subjectAvailabilityModal")).show();
      return;
    }

    const subject = subjectDoc.data();
    const student = studentDoc.exists ? studentDoc.data() : {};
    const creditedIds = new Set(creditedSnap.docs.map((d) => d.data().subjectId));
    const prereqText = (subject.prerequisite || "").trim();
    const prereqCodes = prereqText ? prereqText.split(",").map((c) => c.trim()).filter(Boolean) : [];
    const missingPrereqs = [];
    if (prereqCodes.length) {
      // Map credited subjects by code
      const creditedSubjectsDocs = await Promise.all([...creditedIds].map((id) => db.collection("subjects").doc(id).get()));
      const creditedCodes = new Set(creditedSubjectsDocs.filter((d) => d.exists).map((d) => d.data().subjectCode));
      for (const code of prereqCodes) {
        if (!creditedCodes.has(code)) missingPrereqs.push(code);
      }
    }

    const currentTerm = termDoc.exists ? termDoc.data() : { academicYear: "", semester: "" };
    const offered = (!subject.academicYear || !currentTerm.academicYear || String(subject.academicYear) === String(currentTerm.academicYear)) && (!subject.semester || !currentTerm.semester || String(subject.semester) === String(currentTerm.semester));

    const eligibility = [];
    if (student?.academicHold) eligibility.push("Academic hold");
    const minGpa = Number(subject.minGpa);
    const studentGpa = Number(student?.gpa);
    if (!Number.isNaN(minGpa) && minGpa > 0 && !Number.isNaN(studentGpa) && studentGpa < minGpa) eligibility.push(`Requires GPA ${minGpa}`);
    if (subject.requiredStanding && student?.academicStanding && String(subject.requiredStanding) !== String(student.academicStanding)) eligibility.push(`Requires ${subject.requiredStanding}`);

    const parts = [];
    parts.push(`<div class="mb-2"><strong>${escapeHtml(subject.subjectCode)} — ${escapeHtml(subject.subjectName)}</strong></div>`);
    parts.push(`<div class="small text-muted mb-2">Units: ${escapeHtml(subject.units || "-")} • Semester: ${escapeHtml(subject.semester || "-")}</div>`);
    parts.push(`<div class="mb-2">Availability this term: <strong>${offered ? "Yes" : "No"}</strong></div>`);
    if (missingPrereqs.length) parts.push(`<div class="mb-2 text-warning">Missing prerequisite(s): ${escapeHtml(missingPrereqs.join(", "))}</div>`);
    if (eligibility.length) parts.push(`<div class="mb-2 text-danger">Eligibility issues: ${escapeHtml(eligibility.join("; "))}</div>`);
    if (!missingPrereqs.length && eligibility.length === 0 && offered) parts.push(`<div class="alert alert-success small">You appear eligible to take this subject (per current records).</div>`);

    modalBody.innerHTML = parts.join("");
    new bootstrap.Modal(document.getElementById("subjectAvailabilityModal")).show();
  } catch (err) {
    console.error(err);
    showError(err, "Failed to evaluate subject availability.");
  }
}
