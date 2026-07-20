const SEM_ORDER = ["1st Semester", "2nd Semester", "Midterm", "Summer"];

async function initStudentPOS(content, profile) {
  content.innerHTML = `<div class="section-card no-print"><div class="text-muted small">Loading your Program of Studies...</div></div>`;

  try {
    const [studentDoc, subjectsSnap, creditedSnap, assignSnap] = await Promise.all([
      db.collection("students").doc(profile.studentId).get(),
      db.collection("subjects").get(),
      db.collection("creditedSubjects").where("studentId", "==", profile.studentId).get(),
      db.collection("studentSubjects").where("studentId", "==", profile.studentId).get()
    ]);

    if (!studentDoc.exists) {
      content.innerHTML = `
        <div class="section-card no-print">
          <div class="alert alert-warning mb-0">
            <i class="bi bi-exclamation-triangle me-1"></i>
            We couldn't find your student record. Please contact your Administrator.
          </div>
        </div>`;
      return;
    }

    const student = { id: profile.studentId, ...studentDoc.data() };
    const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const assignedDocs = assignSnap.docs.map((d) => d.data());

    const creditedMap = buildCreditedMap(creditedDocs);
    const assignedIds = new Set(assignedDocs.map((a) => a.subjectId));

    // Get the required subjects for this student's official curriculum + track
    const requiredSubjects = getRequiredSubjects(student, allSubjects);

    // Group subjects by Year Level and Semester
    const grouped = {};
    YEAR_ORDER.forEach((yr) => {
      grouped[yr] = {};
      SEM_ORDER.forEach((sem) => {
        grouped[yr][sem] = [];
      });
    });

    requiredSubjects.forEach((s) => {
      const yr = s.yearLevel || "1st Year";
      const sem = s.semester || "1st Semester";
      if (!grouped[yr]) grouped[yr] = {};
      if (!grouped[yr][sem]) grouped[yr][sem] = [];
      grouped[yr][sem].push(s);
    });

    // Summary calculations
    let totalSubjects = 0;
    let totalUnits = 0;
    let completedSubjects = 0;
    let completedUnits = 0;
    let inProgressSubjects = 0;
    let inProgressUnits = 0;

    requiredSubjects.forEach((s) => {
      const u = parseInt(s.units) || 0;
      totalSubjects++;
      totalUnits += u;
      
      if (creditedMap.has(s.id)) {
        completedSubjects++;
        completedUnits += u;
      } else if (assignedIds.has(s.id)) {
        inProgressSubjects++;
        inProgressUnits += u;
      }
    });

    // Render page layout
    let html = `
      <!-- Action Controls (Screen Only) -->
      <div class="card mb-4 border-0 shadow-sm no-print">
        <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 class="mb-0 fw-bold"><i class="bi bi-file-earmark-text me-2 text-primary"></i>Program of Studies (POS)</h5>
            <p class="text-muted small mb-0">Generate a printable document showing all curriculum requirements and your progress.</p>
          </div>
          <button type="button" class="btn btn-primary" onclick="window.print()" style="background-color:#1E2749; border-color:#1E2749;">
            <i class="bi bi-printer me-2"></i>Print Program of Studies
          </button>
        </div>
      </div>

      <!-- Printable Report Container -->
      <div class="bg-white p-4 p-md-5 rounded shadow-sm print-container">
        
        <!-- Institutional Header (Visible on print and screen) -->
        <div class="text-center mb-4 pb-3 border-bottom border-dark">
          <img src="../../image/Logo%20transparent.png" alt="University Logo" style="height: 70px; margin-bottom: 8px;" />
          <h4 class="mb-1 fw-bold text-uppercase" style="color: #1E2749; letter-spacing: 1px;">Nexus Integrative University</h4>
          <h6 class="mb-1 text-muted text-uppercase">Office of the College Registrar</h6>
          <h6 class="mb-3 text-muted text-uppercase" style="font-size: 13px;">College of Information and Communications Technology</h6>
          <h5 class="mb-0 fw-bold border-top border-bottom border-dark py-2 text-uppercase" style="background-color: #f8f9fa;">Official Program of Studies</h5>
        </div>

        <!-- Student Information Grid -->
        <div class="row g-3 mb-4" style="font-size: 13px;">
          <div class="col-md-6">
            <table class="table table-sm table-borderless mb-0">
              <tr>
                <td style="width: 30%;" class="text-muted">Student Name:</td>
                <td style="width: 70%;" class="fw-bold">${escapeHtml(student.fullName || profile.fullName || profile.email)}</td>
              </tr>
              <tr>
                <td class="text-muted">Student No:</td>
                <td class="fw-bold">${escapeHtml(student.studentId || "N/A")}</td>
              </tr>
              <tr>
                <td class="text-muted">Course:</td>
                <td class="fw-bold">${escapeHtml(student.course || "BSIT")}</td>
              </tr>
              <tr>
                <td class="text-muted">Specialization:</td>
                <td class="fw-bold">${escapeHtml(student.track || "General / None")}</td>
              </tr>
            </table>
          </div>
          <div class="col-md-6">
            <table class="table table-sm table-borderless mb-0">
              <tr>
                <td style="width: 35%;" class="text-muted">Curriculum Scheme:</td>
                <td style="width: 65%;" class="fw-bold">${escapeHtml(student.curriculum || "New")} Curriculum</td>
              </tr>
              <tr>
                <td class="text-muted">Current Year Level:</td>
                <td class="fw-bold">${escapeHtml(student.yearLevel || "1st Year")}</td>
              </tr>
              <tr>
                <td class="text-muted">Academic Year:</td>
                <td class="fw-bold">${escapeHtml(student.academicYear || "2025-2026")}</td>
              </tr>
              <tr>
                <td class="text-muted">Evaluation Status:</td>
                <td class="fw-bold"><span class="badge ${student.status === 'Graduated' ? 'bg-success' : student.status === 'In Progress' ? 'bg-primary' : 'bg-secondary'}">${escapeHtml(student.status || "Pending")}</span></td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Progress Metrics -->
        <div class="alert alert-light border border-dark rounded-0 p-3 mb-4">
          <div class="row text-center g-2" style="font-size: 13px;">
            <div class="col-sm-4 border-end border-secondary">
              <span class="text-muted d-block small">Curriculum Requirements</span>
              <strong class="fs-6 text-dark">${totalSubjects} Subjects / ${totalUnits} Units</strong>
            </div>
            <div class="col-sm-4 border-end border-secondary">
              <span class="text-muted d-block small">Completed Requirements</span>
              <strong class="fs-6 text-success">${completedSubjects} Subjects / ${completedUnits} Units</strong>
            </div>
            <div class="col-sm-4">
              <span class="text-muted d-block small">In Progress (Current Term)</span>
              <strong class="fs-6 text-primary">${inProgressSubjects} Subjects / ${inProgressUnits} Units</strong>
            </div>
          </div>
        </div>

        <!-- Curriculum Breakdown -->
        <div class="curriculum-pos-body">
    `;

    YEAR_ORDER.forEach((yr) => {
      let yearHasSubjects = false;
      SEM_ORDER.forEach((sem) => {
        if (grouped[yr] && grouped[yr][sem] && grouped[yr][sem].length > 0) {
          yearHasSubjects = true;
        }
      });

      if (yearHasSubjects) {
        html += `
          <div class="mb-4 year-block">
            <h5 class="fw-bold text-dark border-bottom border-secondary pb-1 mb-3" style="font-size: 15px;">
              <i class="bi bi-bookmark-fill me-2 text-primary no-print"></i>${escapeHtml(yr)}
            </h5>
        `;

        SEM_ORDER.forEach((sem) => {
          const list = grouped[yr][sem] || [];
          if (list.length > 0) {
            html += `
              <div class="mb-3 px-2">
                <h6 class="fw-bold text-secondary mb-2" style="font-size: 13px;">${escapeHtml(sem)}</h6>
                <table class="table table-bordered table-sm align-middle" style="font-size: 12px;">
                  <thead class="table-light">
                    <tr>
                      <th style="width: 15%;">Subject Code</th>
                      <th style="width: 40%;">Subject Name</th>
                      <th style="width: 10%;" class="text-center">Units</th>
                      <th style="width: 15%;">Prerequisite</th>
                      <th style="width: 20%;">Remarks / Status</th>
                    </tr>
                  </thead>
                  <tbody>
            `;

            list.forEach((s) => {
              const credited = creditedMap.has(s.id);
              let statusText = "";
              let rowClass = "";

              if (credited) {
                const cred = creditedMap.get(s.id);
                const fromStr = cred.creditedFrom ? ` (from ${cred.creditedFrom})` : "";
                statusText = `<span class="text-success fw-bold"><i class="bi bi-check-circle-fill me-1"></i>Completed${fromStr}</span>`;
                rowClass = "table-success-light";
              } else if (assignedIds.has(s.id)) {
                statusText = `<span class="text-primary fw-semibold"><i class="bi bi-arrow-repeat me-1"></i>Enrolled / In Progress</span>`;
                rowClass = "table-primary-light";
              } else {
                // Full catalog, not just this student's required subjects -
                // a prerequisite can live in a different track/year than the
                // subject that needs it (same lookup scope as credit-eval-view.js).
                const reason = getNotCreditedReason(s, creditedMap, allSubjects);
                const isPrereq = reason.indexOf("Requires prerequisite") === 0;
                if (isPrereq) {
                  statusText = `<span class="text-warning-emphasis small"><i class="bi bi-lock-fill me-1"></i>Prereq: ${escapeHtml(s.prerequisite)}</span>`;
                } else {
                  statusText = `<span class="text-muted"><i class="bi bi-circle me-1"></i>Not Taken</span>`;
                }
              }

              html += `
                <tr class="${rowClass}">
                  <td class="fw-bold">${escapeHtml(s.subjectCode)}</td>
                  <td>${escapeHtml(s.subjectName)}</td>
                  <td class="text-center">${escapeHtml(s.units)}</td>
                  <td><span class="text-muted">${escapeHtml(s.prerequisite || "None")}</span></td>
                  <td>${statusText}</td>
                </tr>
              `;
            });

            html += `
                  </tbody>
                </table>
              </div>
            `;
          }
        });

        html += `</div>`;
      }
    });

    html += `
        <!-- Signature & Approvals Block -->
        <div class="row mt-5 pt-4 border-top border-secondary text-center" style="font-size: 13px;">
          <div class="col-md-4 mb-4">
            <div class="mb-4 border-bottom border-dark mx-auto" style="width: 80%; height: 30px;"></div>
            <strong>${escapeHtml(student.fullName || profile.fullName || profile.email)}</strong>
            <span class="d-block text-muted small">Student Signature / Date</span>
          </div>
          <div class="col-md-4 mb-4">
            <div class="mb-4 border-bottom border-dark mx-auto" style="width: 80%; height: 30px;"></div>
            <strong>University Evaluator</strong>
            <span class="d-block text-muted small">Evaluated By / Date</span>
          </div>
          <div class="col-md-4 mb-4">
            <div class="mb-4 border-bottom border-dark mx-auto" style="width: 80%; height: 30px;"></div>
            <strong>College Registrar</strong>
            <span class="d-block text-muted small">Approved By / Date</span>
          </div>
        </div>

      </div>
    `;

    content.innerHTML = html;

  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <div class="section-card no-print">
        <div class="alert alert-danger mb-2">
          <i class="bi bi-exclamation-octagon me-1"></i>
          Something went wrong generating the Program of Studies.
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>`;
    showError(err, "Failed to load Program of Studies.");
  }
}
