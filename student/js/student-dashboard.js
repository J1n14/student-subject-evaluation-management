async function initStudentDashboard(content, profile) {
  content.innerHTML = `<div class="text-muted small">Loading your dashboard...</div>`;

  const studentDoc = await db.collection("students").doc(profile.studentId).get();
  const student = studentDoc.exists ? studentDoc.data() : {};

  const [assignSnap, creditSnap] = await Promise.all([
    db.collection("studentSubjects").where("studentId", "==", profile.studentId).get(),
    db.collection("creditedSubjects").where("studentId", "==", profile.studentId).orderBy("creditedAt", "desc").get()
  ]);

  const assignedCount = assignSnap.size;
  const creditedCount = creditSnap.size;
  const latestCredit = creditSnap.docs[0]?.data();
  const status = student.status || "Pending";

  content.innerHTML = `
    <div class="section-card">
      <h4>Welcome, ${escapeHtml(profile.fullName || student.fullName || profile.email)}! 👋</h4>
      <p class="text-muted mb-0">${escapeHtml(student.track || "")} ${student.yearLevel ? "&middot; " + escapeHtml(student.yearLevel) : ""}</p>
    </div>
    <div class="row g-3 mt-1">
      <div class="col-6 col-lg-3">
        <div class="summary-card bg-card-1">
          <div class="small opacity-75">Assigned Subjects</div>
          <h3>${assignedCount}</h3>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="summary-card bg-card-2">
          <div class="small opacity-75">Subjects Credited</div>
          <h3>${creditedCount}</h3>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="summary-card bg-card-3">
          <div class="small opacity-75">Credit Status</div>
          <h3 class="fs-5">${statusBadge(status)}</h3>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="summary-card bg-card-4">
          <div class="small opacity-75">Last Credited</div>
          <h3 class="fs-5">${latestCredit ? formatDate(latestCredit.creditedAt) : "—"}</h3>
        </div>
      </div>
    </div>
    <div class="section-card mt-3">
      <p class="mb-0">
        Head to <a href="student-subjects.html">My Subjects</a> to see what's assigned to you this term, or check
        <a href="student-evaluations.html">My Credit Evaluation</a> to see your progress toward graduation.
      </p>
    </div>`;
}
