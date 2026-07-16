async function initAdminDashboard(content) {
  content.innerHTML = `
    <div class="row g-3 mb-2" id="summary-cards"></div>
    <div class="row g-3 mt-1">
      <div class="col-lg-6">
        <div class="table-responsive-card mb-3">
          <h6 class="mb-3"><i class="bi bi-award me-1"></i>Recent Credited Subjects</h6>
          <div id="recent-credits"><div class="text-muted small">Loading...</div></div>
        </div>
        <div class="table-responsive-card">
          <h6 class="mb-3"><i class="bi bi-pie-chart me-1"></i>Credit Status</h6>
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
    const [studentsSnap, subjectsSnap, creditedSnap] = await Promise.all([
      db.collection("students").get(),
      db.collection("subjects").get(),
      db.collection("creditedSubjects").get()
    ]);

    const totalStudents = studentsSnap.size;
    const graduated = studentsSnap.docs.filter((d) => d.data().status === "Graduated").length;
    const inProgress = studentsSnap.docs.filter((d) => d.data().status === "In Progress").length;
    const pending = totalStudents - graduated - inProgress;
    const totalSubjects = subjectsSnap.size;
    const totalCredited = creditedSnap.size;

    renderSummaryCards({ totalStudents, graduated, inProgress, pending, totalSubjects, totalCredited });
    renderStatusChart(graduated, inProgress, pending);
    renderStatsList({ totalStudents, graduated, inProgress, pending, totalSubjects, totalCredited });

    await Promise.all([loadRecentCreditedSubjects(), loadRecentLogins()]);
  } catch (err) {
    showError(err, "Failed to load dashboard data.");
  }
}

function renderSummaryCards({ totalStudents, graduated, inProgress, pending, totalSubjects }) {
  const cards = [
    { label: "Total Students", value: totalStudents, icon: "bi-people", cls: "bg-card-1" },
    { label: "Graduated Students", value: graduated, icon: "bi-check-circle", cls: "bg-card-2" },
    { label: "In Progress", value: inProgress, icon: "bi-hourglass-split", cls: "bg-card-3" },
    { label: "Total Subjects", value: totalSubjects, icon: "bi-journal-bookmark", cls: "bg-card-4" }
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

function renderStatsList({ totalStudents, graduated, inProgress, pending, totalSubjects, totalCredited }) {
  const rate = totalStudents ? Math.round((graduated / totalStudents) * 100) : 0;
  const avgCreditedPerStudent = totalStudents ? (totalCredited / totalStudents).toFixed(1) : "0.0";
  document.getElementById("stats-list").innerHTML = `
    <li class="list-group-item d-flex justify-content-between"><span>Graduation rate</span><strong>${rate}%</strong></li>
    <li class="list-group-item d-flex justify-content-between"><span>Avg. credited subjects per student</span><strong>${avgCreditedPerStudent}</strong></li>
    <li class="list-group-item d-flex justify-content-between"><span>Students pending credit review</span><strong>${pending}</strong></li>`;
}

let statusChartInstance = null;
function renderStatusChart(graduated, inProgress, pending) {
  const ctx = document.getElementById("statusChart");
  if (!ctx || typeof Chart === "undefined") return;
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Graduated", "In Progress", "Pending"],
      datasets: [{ data: [graduated, inProgress, pending], backgroundColor: ["#2e9e6a", "#7c5cff", "#ff8c42"] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

async function loadRecentCreditedSubjects() {
  const snap = await db.collection("creditedSubjects").orderBy("creditedAt", "desc").limit(5).get();
  if (snap.empty) {
    document.getElementById("recent-credits").innerHTML = `<div class="text-muted small">No credited subjects yet.</div>`;
    return;
  }
  const rows = await Promise.all(
    snap.docs.map(async (doc) => {
      const c = doc.data();
      const [studentDoc, subjectDoc] = await Promise.all([
        db.collection("students").doc(c.studentId).get(),
        db.collection("subjects").doc(c.subjectId).get()
      ]);
      return `<tr>
        <td>${escapeHtml(studentDoc.exists ? studentDoc.data().fullName : c.studentId)}</td>
        <td>${escapeHtml(subjectDoc.exists ? subjectDoc.data().subjectCode : c.subjectId)}</td>
        <td class="text-muted small">${formatDateTime(c.creditedAt)}</td>
      </tr>`;
    })
  );
  document.getElementById("recent-credits").innerHTML = `
    <div class="table-responsive"><table class="table table-sm align-middle mb-0">
      <thead><tr><th>Student</th><th>Course Code</th><th>When</th></tr></thead>
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
