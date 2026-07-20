const SEM_ORDER = ["1st Semester", "2nd Semester", "Midterm", "Summer"];

async function initStudentTOR(content, profile) {
  content.innerHTML = `<div class="section-card no-print"><div class="text-muted small">Loading your Transcript of Records...</div></div>`;

  try {
    const [studentDoc, subjectsSnap, creditedSnap] = await Promise.all([
      db.collection("students").doc(profile.studentId).get(),
      db.collection("subjects").get(),
      db.collection("creditedSubjects").where("studentId", "==", profile.studentId).get()
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
    const isTransferee = student.studentType === "Transferee";

    const allSubjects = Object.fromEntries(
      subjectsSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }])
    );
    const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Map each credited document to its subject information
    const creditedList = creditedDocs.map((c) => {
      const subj = allSubjects[c.subjectId] || {};
      return {
        ...c,
        subjectCode: subj.subjectCode || "N/A",
        subjectName: subj.subjectName || "Unknown Subject",
        units: subj.units || 0,
        yearLevel: subj.yearLevel || "N/A",
        semester: subj.semester || "N/A"
      };
    }).sort((a, b) => {
      const yrA = YEAR_ORDER.indexOf(a.yearLevel);
      const yrB = YEAR_ORDER.indexOf(b.yearLevel);
      if (yrA !== yrB) return yrA - yrB;
      
      const semA = SEM_ORDER.indexOf(a.semester);
      const semB = SEM_ORDER.indexOf(b.semester);
      if (semA !== semB) return semA - semB;
      
      return a.subjectCode.localeCompare(b.subjectCode);
    });

    let totalCredits = 0;
    creditedList.forEach((c) => {
      totalCredits += parseInt(c.units) || 0;
    });

    const docTitle = isTransferee ? "Transcript of Transfer Records" : "Official Transcript of Records";
    const subTitle = isTransferee ? "Transfer Credits Evaluation" : "Academic Records Summary";

    let html = `
      <!-- Action Controls (Screen Only) -->
      <div class="card mb-4 border-0 shadow-sm no-print">
        <div class="card-body d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 class="mb-0 fw-bold"><i class="bi bi-file-earmark-ruled me-2 text-primary"></i>${escapeHtml(docTitle)}</h5>
            <p class="text-muted small mb-0">Official summary of all credited courses and academic progress.</p>
          </div>
          <button type="button" class="btn btn-primary" onclick="window.print()" style="background-color:#1E2749; border-color:#1E2749;">
            <i class="bi bi-printer me-2"></i>Print Transcript
          </button>
        </div>
      </div>

      <!-- Printable Document -->
      <div class="bg-white p-4 p-md-5 rounded shadow-sm print-container">
        
        <!-- Institutional Header -->
        <div class="text-center mb-4 pb-3 border-bottom border-dark">
          <img src="../../image/Logo%20transparent.png" alt="University Logo" style="height: 70px; margin-bottom: 8px;" />
          <h4 class="mb-1 fw-bold text-uppercase" style="color: #1E2749; letter-spacing: 1px;">Nexus Integrative University</h4>
          <h6 class="mb-1 text-muted text-uppercase">Office of the College Registrar</h6>
          <h6 class="mb-3 text-muted text-uppercase" style="font-size: 13px;">College of Information and Communications Technology</h6>
          <h5 class="mb-0 fw-bold border-top border-bottom border-dark py-2 text-uppercase" style="background-color: #f8f9fa;">${escapeHtml(docTitle)}</h5>
        </div>

        <!-- Student Details Grid -->
        <div class="row g-3 mb-4" style="font-size: 13px;">
          <div class="col-md-6">
            <table class="table table-sm table-borderless mb-0">
              <tr>
                <td style="width: 35%;" class="text-muted">Student Name:</td>
                <td style="width: 65%;" class="fw-bold">${escapeHtml(student.fullName || profile.fullName || profile.email)}</td>
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
              ${isTransferee ? `
              <tr>
                <td style="width: 40%;" class="text-muted">Previous School:</td>
                <td style="width: 60%;" class="fw-bold text-primary">${escapeHtml(student.previousSchool || "Not Specified")}</td>
              </tr>
              <tr>
                <td class="text-muted">Last School Year Attended:</td>
                <td class="fw-bold">${escapeHtml(student.lastSchoolYearAttended || "N/A")}</td>
              </tr>
              ` : `
              <tr>
                <td style="width: 40%;" class="text-muted">Institution:</td>
                <td style="width: 60%;" class="fw-bold">Nexus Integrative University</td>
              </tr>
              <tr>
                <td class="text-muted">Curriculum Scheme:</td>
                <td class="fw-bold">${escapeHtml(student.curriculum || "New")} Curriculum</td>
              </tr>
              `}
              <tr>
                <td class="text-muted">Total Completed Units:</td>
                <td class="fw-bold text-success">${totalCredits} Units Credited</td>
              </tr>
              <tr>
                <td class="text-muted">Student Classification:</td>
                <td class="fw-bold"><span class="badge bg-secondary text-uppercase">${escapeHtml(student.studentType || "Regular")}</span></td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Table of Credits -->
        <div class="mb-4">
          <h5 class="fw-bold text-dark border-bottom border-secondary pb-1 mb-3" style="font-size: 14px;">Academic Record Summary &amp; Credits</h5>
          
          ${creditedList.length === 0 ? `
            <div class="alert alert-info py-3">
              <i class="bi bi-info-circle me-2"></i>No academic credits have been recorded on your profile yet.
            </div>
          ` : `
            <table class="table table-bordered table-sm align-middle" style="font-size: 12px;">
              <thead class="table-light">
                <tr>
                  <th style="width: 15%;">Subject Code</th>
                  <th style="width: 35%;">Subject Name</th>
                  <th style="width: 8%;" class="text-center">Units</th>
                  <th style="width: 22%;">Credited From / Institution</th>
                  <th style="width: 20%;">Remarks</th>
                </tr>
              </thead>
              <tbody>
                ${creditedList.map((c) => `
                  <tr>
                    <td class="fw-bold text-brand">${escapeHtml(c.subjectCode)}</td>
                    <td>${escapeHtml(c.subjectName)}</td>
                    <td class="text-center">${escapeHtml(c.units)}</td>
                    <td>${escapeHtml(c.creditedFrom || (isTransferee ? (student.previousSchool || "Previous School") : "Nexus Integrative University"))}</td>
                    <td><span class="text-muted small">${escapeHtml(c.remarks || "Completed")}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `}
        </div>

        <!-- Signature Block -->
        <div class="row mt-5 pt-4 border-top border-secondary text-center" style="font-size: 13px;">
          <div class="col-6 mb-4">
            <div class="mb-4 border-bottom border-dark mx-auto" style="width: 70%; height: 30px;"></div>
            <strong>${escapeHtml(student.fullName || profile.fullName || profile.email)}</strong>
            <span class="d-block text-muted small">Student Signature / Date Signed</span>
          </div>
          <div class="col-6 mb-4">
            <div class="mb-4 border-bottom border-dark mx-auto" style="width: 70%; height: 30px;"></div>
            <strong>College Registrar</strong>
            <span class="d-block text-muted small">Certified Correct / Date</span>
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
          Something went wrong loading your TOR.
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>`;
    showError(err, "Failed to load Transcript of Records.");
  }
}
