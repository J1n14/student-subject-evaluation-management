async function initAdminDashboard(content) {
  content.innerHTML = `
    <div class="row g-3 mb-2" id="summary-cards"></div>
    <div class="row g-3 mt-1">
      <div class="col-lg-6">
        <div class="table-responsive-card mb-3">
          <h6 class="mb-3"><i class="bi bi-clipboard-check me-1"></i>Recent Evaluations</h6>
          <div id="recent-evaluations"><div class="text-muted small">Loading...</div></div>
        </div>
        <div class="table-responsive-card">
          <h6 class="mb-3"><i class="bi bi-pie-chart me-1"></i>Evaluation Status</h6>
          <div style="position: relative; height: 180px;">
            <canvas id="statusChart"></canvas>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="table-responsive-card mb-3">
          <h6 class="mb-3"><i class="bi bi-box-arrow-in-right me-1"></i>Recent Student Logins</h6>
          <div id="recent-logins"><div class="text-muted small">Loading...</div></div>
        </div>
        <div class="table-responsive-card">
          <h6 class="mb-3"><i class="bi bi-bar-chart me-1"></i>Statistics</h6>
          <ul class="list-group list-group-flush" id="stats-list"></ul>
        </div>
      </div>
    </div>`;

  await loadDashboardData();
}

async function loadDashboardData() {
  try {
    const [studentsSnap, subjectsSnap, evaluationsSnap] = await Promise.all([
      db.collection("students").get(),
      db.collection("subjects").get(),
      db.collection("evaluations").get()
    ]);

    const totalStudents = studentsSnap.size;
    const evaluated = studentsSnap.docs.filter((d) => d.data().status === "Evaluated").length;
    const pending = studentsSnap.docs.filter((d) => d.data().status !== "Evaluated").length;
    const totalSubjects = subjectsSnap.size;
    const totalEvaluations = evaluationsSnap.size;

    renderSummaryCards({ totalStudents, evaluated, pending, totalSubjects, totalEvaluations });
    renderStatusChart(evaluated, pending);
    renderStatsList({ totalStudents, evaluated, pending, totalSubjects, totalEvaluations });

    await Promise.all([loadRecentEvaluations(), loadRecentLogins()]);
  } catch (err) {
    showError(err, "Failed to load dashboard data.");
  }
}

function renderSummaryCards({ totalStudents, evaluated, pending, totalSubjects, totalEvaluations }) {
  const cards = [
    { label: "Total Students", value: totalStudents, icon: "bi-people", cls: "bg-card-1" },
    { label: "Evaluated Students", value: evaluated, icon: "bi-check-circle", cls: "bg-card-2" },
    { label: "Pending Students", value: pending, icon: "bi-hourglass-split", cls: "bg-card-3" },
    { label: "Total Subjects", value: totalSubjects, icon: "bi-journal-bookmark", cls: "bg-card-4" },
    { label: "Total Evaluations", value: totalEvaluations, icon: "bi-clipboard-data", cls: "bg-card-5" }
  ];
  document.getElementById("summary-cards").innerHTML = cards
    .map(
      (c) => `
    <div class="col-6 col-lg">
      <div class="summary-card ${c.cls} d-flex justify-content-between align-items-center">
        <div>
          <div class="small opacity-75">${c.label}</div>
          <h3>${c.value}</h3>
        </div>
        <i class="bi ${c.icon} icon"></i>
      </div>
    </div>`
    )
    .join("");
}

function renderStatsList({ totalStudents, evaluated, pending, totalSubjects, totalEvaluations }) {
  const rate = totalStudents ? Math.round((evaluated / totalStudents) * 100) : 0;
  const avgEvalPerSubject = totalSubjects ? (totalEvaluations / totalSubjects).toFixed(1) : "0.0";
  document.getElementById("stats-list").innerHTML = `
    <li class="list-group-item d-flex justify-content-between"><span>Evaluation completion rate</span><strong>${rate}%</strong></li>
    <li class="list-group-item d-flex justify-content-between"><span>Avg. evaluations per subject</span><strong>${avgEvalPerSubject}</strong></li>
    <li class="list-group-item d-flex justify-content-between"><span>Students pending evaluation</span><strong>${pending}</strong></li>`;
}

let statusChartInstance = null;
function renderStatusChart(evaluated, pending) {
  const ctx = document.getElementById("statusChart");
  if (!ctx || typeof Chart === "undefined") return;
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Evaluated", "Pending"],
      datasets: [{ data: [evaluated, pending], backgroundColor: ["#2e9e6a", "#e2a53a"] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

async function loadRecentEvaluations() {
  const snap = await db.collection("evaluations").orderBy("evaluatedAt", "desc").limit(5).get();
  if (snap.empty) {
    document.getElementById("recent-evaluations").innerHTML = `<div class="text-muted small">No evaluations yet.</div>`;
    return;
  }
  const rows = await Promise.all(
    snap.docs.map(async (doc) => {
      const e = doc.data();
      const [studentDoc, subjectDoc] = await Promise.all([
        db.collection("students").doc(e.studentId).get(),
        db.collection("subjects").doc(e.subjectId).get()
      ]);
      return `<tr>
        <td>${escapeHtml(studentDoc.exists ? studentDoc.data().fullName : e.studentId)}</td>
        <td>${escapeHtml(subjectDoc.exists ? subjectDoc.data().subjectCode : e.subjectId)}</td>
        <td>${statusBadge(e.status)}</td>
        <td class="text-muted small">${formatDateTime(e.evaluatedAt)}</td>
      </tr>`;
    })
  );
  document.getElementById("recent-evaluations").innerHTML = `
    <div class="table-responsive"><table class="table table-sm align-middle mb-0">
      <thead><tr><th>Student</th><th>Subject</th><th>Status</th><th>When</th></tr></thead>
      <tbody>${rows.join("")}</tbody>
    </table></div>`;
}

async function loadRecentLogins() {
  const snap = await db
    .collection("activityLogs")
    .where("action", "==", "Student login")
    .orderBy("timestamp", "desc")
    .limit(5)
    .get();
  if (snap.empty) {
    document.getElementById("recent-logins").innerHTML = `<div class="text-muted small">No recent student logins.</div>`;
    return;
  }
  const rows = snap.docs
    .map((doc) => {
      const l = doc.data();
      return `<tr><td>${escapeHtml(l.email)}</td><td class="text-muted small">${formatDateTime(l.timestamp)}</td></tr>`;
    })
    .join("");
  document.getElementById("recent-logins").innerHTML = `
    <div class="table-responsive"><table class="table table-sm align-middle mb-0">
      <thead><tr><th>Email</th><th>When</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}
