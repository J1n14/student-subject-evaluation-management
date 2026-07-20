// Student read-only Credit Evaluation. Uses the shared grouped view
// (shared/js/credit-eval-view.js), rendered non-interactively.
async function initStudentEvaluations(content, profile) {
  content.innerHTML = `<div class="section-card"><div class="text-muted small">Loading your credit evaluation...</div></div>`;

  try {
    const [studentDoc, subjectsSnap, creditedSnap, assignSnap] = await Promise.all([
      db.collection("students").doc(profile.studentId).get(),
      db.collection("subjects").get(),
      db.collection("creditedSubjects").where("studentId", "==", profile.studentId).get(),
      db.collection("studentSubjects").where("studentId", "==", profile.studentId).get()
    ]);

    if (!studentDoc.exists) {
      content.innerHTML = `
        <div class="section-card">
          <div class="alert alert-warning mb-0">
            <i class="bi bi-exclamation-triangle me-1"></i>
            We couldn't find your student record. Please contact your Administrator.
          </div>
        </div>`;
      return;
    }

    const student = { id: profile.studentId, ...studentDoc.data() };
    if (!student.fullName) student.fullName = profile.fullName || profile.email;
    const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const assignedDocs = assignSnap.docs.map((d) => d.data());

    const model = buildEvalModel(student, allSubjects, creditedDocs, assignedDocs);

    content.innerHTML = `<div class="section-card" id="student-eval-card"></div>`;
    renderCreditEvaluation(document.getElementById("student-eval-card"), { student, model, interactive: false });
  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <div class="section-card">
        <div class="alert alert-danger mb-2">
          <i class="bi bi-exclamation-octagon me-1"></i>
          Something went wrong loading your credit evaluation.
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>`;
    showError(err, "Failed to load credit evaluation.");
  }
}