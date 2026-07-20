const SEM_ORDER = ["1st Semester", "2nd Semester", "Midterm", "Summer"];

async function initStudentCurriculum(content, profile) {
  content.innerHTML = `<div class="section-card"><div class="text-muted small">Loading your curriculum details...</div></div>`;

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
    const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const assignedDocs = assignSnap.docs.map((d) => d.data());

    const creditedMap = buildCreditedMap(creditedDocs);
    const assignedIds = new Set(assignedDocs.map((a) => a.subjectId));

    // Default filters to student's own curriculum & track
    let selectedCurriculum = student.curriculum || "New";
    let selectedTrack = student.track || "General";

    function render() {
      // Filter subjects based on selected curriculum & track
      const filteredSubjects = allSubjects.filter((s) => {
        const subjCurriculum = s.curriculum || "New";
        const matchesCurriculum = subjCurriculum === selectedCurriculum;
        
        // New curriculum does not use tracks. Old curriculum matches track, General, or All Tracks
        let matchesTrack = true;
        if (selectedCurriculum === "Old") {
          matchesTrack = !s.track || s.track === selectedTrack || s.track === "General" || s.track === "All Tracks";
        }
        
        const isActive = (s.status || "Active") === "Active";
        return matchesCurriculum && matchesTrack && isActive;
      });

      // Group subjects by Year Level and Semester
      const grouped = {};
      YEAR_ORDER.forEach((yr) => {
        grouped[yr] = {};
        SEM_ORDER.forEach((sem) => {
          grouped[yr][sem] = [];
        });
      });

      filteredSubjects.forEach((s) => {
        const yr = s.yearLevel || "1st Year";
        const sem = s.semester || "1st Semester";
        if (!grouped[yr]) grouped[yr] = {};
        if (!grouped[yr][sem]) grouped[yr][sem] = [];
        grouped[yr][sem].push(s);
      });

      // Calculate total units, total subjects, credited subjects, etc.
      let totalUnits = 0;
      let totalSubjects = 0;
      let creditedUnits = 0;
      let creditedCount = 0;

      filteredSubjects.forEach((s) => {
        const u = parseInt(s.units) || 0;
        totalSubjects++;
        totalUnits += u;
        if (creditedMap.has(s.id)) {
          creditedCount++;
          creditedUnits += u;
        }
      });

      const isOfficial = selectedCurriculum === (student.curriculum || "New") && 
                         (selectedCurriculum === "New" || selectedTrack === student.track);

      // Build header HTML with filters
      let html = `
        <div class="section-card mb-4">
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
            <div>
              <h4 class="mb-1 fw-bold text-primary">
                <i class="bi bi-journal-text me-2"></i>Curriculum Viewer
              </h4>
              <p class="text-muted mb-0 small">
                Your Official Program: <strong>${escapeHtml(student.curriculum || "New")} Curriculum</strong> 
                ${student.track ? ` &middot; <strong>${escapeHtml(student.track)} Track</strong>` : ""}
              </p>
            </div>
            <div class="d-flex flex-wrap gap-2 align-items-center">
              <div>
                <label class="form-label mb-1 text-muted small">Curriculum</label>
                <select id="curriculum-select" class="form-select form-select-sm" style="width: 160px;">
                  <option value="New" ${selectedCurriculum === "New" ? "selected" : ""}>New Curriculum</option>
                  <option value="Old" ${selectedCurriculum === "Old" ? "selected" : ""}>Old Curriculum</option>
                </select>
              </div>
              ${selectedCurriculum === "Old" ? `
              <div>
                <label class="form-label mb-1 text-muted small">Track</label>
                <select id="track-select" class="form-select form-select-sm" style="width: 200px;">
                  <option value="General" ${selectedTrack === "General" ? "selected" : ""}>General / All Tracks</option>
                  <option value="Network Technology" ${selectedTrack === "Network Technology" ? "selected" : ""}>Network Technology</option>
                  <option value="Service Management" ${selectedTrack === "Service Management" ? "selected" : ""}>Service Management</option>
                  <option value="Business Analytics" ${selectedTrack === "Business Analytics" ? "selected" : ""}>Business Analytics</option>
                </select>
              </div>` : ""}
            </div>
          </div>
        </div>

        <div class="row g-3 mb-4">
          <div class="col-md-3 col-sm-6">
            <div class="border rounded p-3 text-center bg-white shadow-sm">
              <div class="fs-3 fw-bold text-dark">${totalSubjects}</div>
              <div class="small text-muted">Total Subjects</div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="border rounded p-3 text-center bg-white shadow-sm">
              <div class="fs-3 fw-bold text-dark">${totalUnits}</div>
              <div class="small text-muted">Total Units</div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="border rounded p-3 text-center bg-white shadow-sm" style="background-color: #eafaf1;">
              <div class="fs-3 fw-bold text-success">${creditedCount} / ${totalSubjects}</div>
              <div class="small text-muted">Subjects Credited</div>
            </div>
          </div>
          <div class="col-md-3 col-sm-6">
            <div class="border rounded p-3 text-center bg-white shadow-sm" style="background-color: #f0f7ff;">
              <div class="fs-3 fw-bold text-primary">${creditedUnits} / ${totalUnits}</div>
              <div class="small text-muted">Units Completed</div>
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
          <div>
            ${isOfficial ? `
              <span class="badge bg-success p-2"><i class="bi bi-patch-check-fill me-1"></i>Official Curriculum</span>
            ` : `
              <span class="badge bg-warning text-dark p-2"><i class="bi bi-eye-fill me-1"></i>Previewing Alternative Curriculum</span>
            `}
          </div>
          <div class="eval-legend small text-muted">
            <span class="legend-dot bg-success"></span>Credited
            <span class="legend-dot bg-primary ms-2"></span>Taking
            <span class="legend-dot legend-open ms-2"></span>To take
            <span class="legend-dot bg-warning ms-2"></span>Prereq needed
          </div>
        </div>

        <div class="curriculum-body">
      `;

      // Render by Year Level & Semester
      let hasData = false;
      YEAR_ORDER.forEach((yr) => {
        let yearHasSubjects = false;
        SEM_ORDER.forEach((sem) => {
          if (grouped[yr][sem] && grouped[yr][sem].length > 0) {
            yearHasSubjects = true;
            hasData = true;
          }
        });

        if (yearHasSubjects) {
          html += `
            <div class="card mb-4 border-0 shadow-sm">
              <div class="card-header bg-brand text-white fw-bold py-3">
                <i class="bi bi-calendar3 me-2"></i>${escapeHtml(yr)}
              </div>
              <div class="card-body p-0">
          `;

          SEM_ORDER.forEach((sem) => {
            const list = grouped[yr][sem] || [];
            if (list.length > 0) {
              html += `
                <div class="p-3 border-bottom">
                  <h6 class="fw-bold text-secondary mb-3"><i class="bi bi-chevron-right me-1"></i>${escapeHtml(sem)}</h6>
                  <div class="table-responsive">
                    <table class="table table-hover align-middle mb-0">
                      <thead>
                        <tr>
                          <th style="width: 15%;">Code</th>
                          <th style="width: 45%;">Subject Name</th>
                          <th style="width: 10%;">Units</th>
                          <th style="width: 15%;">Prerequisite</th>
                          <th style="width: 15%;" class="text-end">Status</th>
                        </tr>
                      </thead>
                      <tbody>
              `;

              list.forEach((s) => {
                const credited = creditedMap.has(s.id);
                let pill = "";
                if (credited) {
                  pill = `<span class="badge rounded-pill bg-success">Credited</span>`;
                } else {
                  // Full catalog, not just the filtered/required subjects -
                  // a prerequisite can live in a different track/year than the
                  // subject that needs it (same lookup scope as credit-eval-view.js).
                  const reason = getNotCreditedReason(s, creditedMap, allSubjects);
                  const isPrereq = reason.indexOf("Requires prerequisite") === 0;
                  const isTaking = !isPrereq && assignedIds.has(s.id);
                  if (isPrereq) {
                    pill = `<span class="badge rounded-pill bg-warning text-dark" title="${escapeHtml(reason)}">Prereq needed</span>`;
                  } else if (isTaking) {
                    pill = `<span class="badge rounded-pill bg-primary">Taking</span>`;
                  } else {
                    pill = `<span class="badge rounded-pill open-pill">To take</span>`;
                  }
                }

                html += `
                  <tr>
                    <td class="fw-semibold text-brand">${escapeHtml(s.subjectCode)}</td>
                    <td>${escapeHtml(s.subjectName)}</td>
                    <td>${escapeHtml(s.units)}</td>
                    <td><span class="text-muted small">${escapeHtml(s.prerequisite || "None")}</span></td>
                    <td class="text-end">${pill}</td>
                  </tr>
                `;
              });

              html += `
                      </tbody>
                    </table>
                  </div>
                </div>
              `;
            }
          });

          html += `
              </div>
            </div>
          `;
        }
      });

      if (!hasData) {
        html += `
          <div class="alert alert-info">
            No subjects found for ${escapeHtml(selectedCurriculum)} curriculum ${selectedCurriculum === "Old" ? ` &middot; ${escapeHtml(selectedTrack)} track` : ""}.
          </div>`;
      }

      html += `</div>`;
      content.innerHTML = html;

      // Add event listeners
      document.getElementById("curriculum-select").addEventListener("change", (e) => {
        selectedCurriculum = e.target.value;
        if (selectedCurriculum === "New") {
          selectedTrack = "General";
        }
        render();
      });

      const trackSel = document.getElementById("track-select");
      if (trackSel) {
        trackSel.addEventListener("change", (e) => {
          selectedTrack = e.target.value;
          render();
        });
      }
    }

    render();

  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <div class="section-card">
        <div class="alert alert-danger mb-2">
          <i class="bi bi-exclamation-octagon me-1"></i>
          Something went wrong loading your curriculum.
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
          <i class="bi bi-arrow-clockwise me-1"></i>Retry
        </button>
      </div>`;
    showError(err, "Failed to load curriculum.");
  }
}
