async function initStudentDashboard(content, profile) {
  content.innerHTML = `<div class="text-muted small">Loading your dashboard...</div>`;

  try {
    const studentDoc = await db.collection("students").doc(profile.studentId).get();

    if (!studentDoc.exists) {
      // The users/{uid} profile points at a students/{studentId} doc that no
      // longer exists (e.g. deleted by an Admin while the account is still
      // active). Show a clear message instead of a dashboard full of zeros.
      content.innerHTML = `
        <div class="section-card">
          <div class="alert alert-warning mb-0">
            <i class="bi bi-exclamation-triangle me-1"></i>
            We couldn't find your student record. Please contact your Administrator.
          </div>
        </div>`;
      return;
    }

    const student = studentDoc.data();

    const [assignSnap, creditSnap] = await Promise.all([
      db.collection("studentSubjects").where("studentId", "==", profile.studentId).get(),
      db.collection("creditedSubjects").where("studentId", "==", profile.studentId).orderBy("creditedAt", "desc").get()
    ]);

    const assignedCount = assignSnap.size;
    const creditedCount = creditSnap.size;
    const latestCredit = creditSnap.docs[0]?.data();
    const status = student.status || "Pending";

    // Compute assigned units by fetching subject docs for assigned subjects
    const assignedIds = assignSnap.docs.map((d) => d.data().subjectId);
    let assignedUnits = 0;
    if (assignedIds.length) {
      const subjectDocs = await Promise.all(assignedIds.map((id) => db.collection("subjects").doc(id).get()));
      subjectDocs.forEach((s) => {
        if (s.exists) assignedUnits += Number(s.data().units) || 0;
      });
    }

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
            ${student.academicHold ? `<div class="small text-warning mt-1">On hold: ${escapeHtml(student.holdReason || "Contact administration for details")}</div>` : ``}
          </div>
        </div>
        <div class="col-6 col-lg-3">
          <div class="summary-card bg-card-4">
            <div class="small opacity-75">Assigned Units</div>
            <h3 class="fs-5">${assignedUnits}</h3>
            <div class="small text-muted mt-1">Credit load for assigned subjects</div>
          </div>
        </div>
      </div>
      <div class="section-card mt-3">
        <p class="mb-0">
          Head to <a href="student-subjects.html">My Subjects</a> to see what's assigned to you this term, or check
          <a href="student-evaluations.html">My Credit Evaluation</a> to see your progress toward graduation.
        </p>
      </div>`;
  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <div class="section-card">
        <div class="alert alert-danger mb-2">
          <i class="bi bi-exclamation-octagon me-1"></i>
          Something went wrong loading your dashboard.
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>`;
    showError(err, "Failed to load dashboard.");
  }
}