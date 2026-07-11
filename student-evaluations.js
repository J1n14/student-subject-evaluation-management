let studentEvalUnsub = null;

async function initStudentEvaluations(content, profile) {
  content.innerHTML = `
    <div class="table-responsive-card">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0"><i class="bi bi-clipboard-check me-1"></i>My Evaluation Results</h6>
        <span id="overall-status-badge"></span>
      </div>
      <div class="table-responsive">
        <table class="table table-hover align-middle">
          <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Status</th><th>Remarks</th><th>Date Evaluated</th></tr></thead>
          <tbody id="my-evals-tbody"><tr><td colspan="5" class="text-center text-muted py-3">Loading...</td></tr></tbody>
        </table>
      </div>
    </div>`;

  const studentDoc = await db.collection("students").doc(profile.studentId).get();
  const overallStatus = studentDoc.exists ? studentDoc.data().status || "Pending" : "Pending";
  document.getElementById("overall-status-badge").innerHTML = statusBadge(overallStatus);

  if (studentEvalUnsub) studentEvalUnsub();
  studentEvalUnsub = db
    .collection("evaluations")
    .where("studentId", "==", profile.studentId)
    .onSnapshot(async (snap) => {
      if (snap.empty) {
        document.getElementById("my-evals-tbody").innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No evaluations recorded yet.</td></tr>`;
        return;
      }
      const rows = await Promise.all(
        snap.docs.map(async (d) => {
          const e = d.data();
          const subDoc = await db.collection("subjects").doc(e.subjectId).get();
          const sub = subDoc.exists ? subDoc.data() : { subjectCode: "?", subjectName: "Unknown" };
          return `<tr>
            <td>${escapeHtml(sub.subjectCode)}</td>
            <td>${escapeHtml(sub.subjectName)}</td>
            <td>${statusBadge(e.status)}</td>
            <td>${escapeHtml(e.remarks || "—")}</td>
            <td>${formatDate(e.evaluatedAt)}</td>
          </tr>`;
        })
      );
      document.getElementById("my-evals-tbody").innerHTML = rows.join("");
    });
}
