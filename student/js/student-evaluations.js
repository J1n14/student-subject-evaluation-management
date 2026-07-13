// Student read-only Credit Evaluation. Uses the shared grouped view
// (shared/js/credit-eval-view.js), rendered non-interactively.
async function initStudentEvaluations(content, profile) {
  content.innerHTML = `<div class="section-card"><div class="text-muted small">Loading your credit evaluation...</div></div>`;

  const [studentDoc, subjectsSnap, creditedSnap] = await Promise.all([
    db.collection("students").doc(profile.studentId).get(),
    db.collection("subjects").get(),
    db.collection("creditedSubjects").where("studentId", "==", profile.studentId).get()
  ]);

  const student = { id: profile.studentId, ...(studentDoc.exists ? studentDoc.data() : {}) };
  if (!student.fullName) student.fullName = profile.fullName || profile.email;
  const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const model = buildEvalModel(student, allSubjects, creditedDocs);

  content.innerHTML = `<div class="section-card" id="student-eval-card"></div>`;
  renderCreditEvaluation(document.getElementById("student-eval-card"), { student, model, interactive: false });
}
