async function initStudentEvaluations(content, profile) {
  content.innerHTML = `<div class="text-muted small">Loading your credit evaluation...</div>`;

  const [studentDoc, subjectsSnap, creditedSnap] = await Promise.all([
    db.collection("students").doc(profile.studentId).get(),
    db.collection("subjects").get(),
    db.collection("creditedSubjects").where("studentId", "==", profile.studentId).get()
  ]);

  const student = { id: profile.studentId, ...(studentDoc.exists ? studentDoc.data() : {}) };
  const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const requiredSubjects = getRequiredSubjects(student, allSubjects);
  const requiredSubjectsById = Object.fromEntries(requiredSubjects.map((s) => [s.id, s]));
  const creditedMap = buildCreditedMap(creditedDocs);

  const creditedRows = requiredSubjects.filter((s) => creditedMap.has(s.id));
  const stillToTakeRows = requiredSubjects
    .filter((s) => !creditedMap.has(s.id))
    .sort((a, b) => {
      const yearDiff = YEAR_ORDER.indexOf(a.yearLevel) - YEAR_ORDER.indexOf(b.yearLevel);
      if (yearDiff !== 0) return yearDiff;
      if (a.semester !== b.semester) return (a.semester || "").localeCompare(b.semester || "");
      return (a.subjectCode || "").localeCompare(b.subjectCode || "");
    });

  const emptyPoolNotice =
    requiredSubjects.length === 0
      ? `<div class="alert alert-warning">No catalog subjects found yet for your <strong>${escapeOrDash(student.curriculum)} curriculum</strong> / <strong>${escapeOrDash(student.track)} track</strong>. Check back once your Admin has added them.</div>`
      : "";

  content.innerHTML = `
    <div class="table-responsive-card">
      <div class="d-flex justify-content-between align-items-start mb-3">
        <div>
          <h5 class="mb-0">${escapeHtml(student.fullName || profile.fullName || profile.email)}</h5>
        </div>
        ${statusBadge(student.status || "Pending")}
      </div>

      ${emptyPoolNotice}

      <h6 class="mb-2">Credited Subjects</h6>
      <div class="table-responsive mb-4">
        <table class="table table-sm">
          <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Credited From</th><th>Grade</th><th>Remarks</th></tr></thead>
          <tbody>
            ${
              creditedRows.length
                ? creditedRows
                    .map((s) => {
                      const record = creditedMap.get(s.id);
                      return `
                  <tr>
                    <td class="text-nowrap">${escapeHtml(s.subjectCode)}</td>
                    <td>${escapeHtml(s.subjectName)}</td>
                    <td>${escapeHtml(s.units)}</td>
                    <td>${escapeHtml(record.creditedFrom)}</td>
                    <td>${escapeHtml(record.grade)}</td>
                    <td>${escapeOrDash(record.remarks)}</td>
                  </tr>`;
                    })
                    .join("")
                : `<tr><td colspan="6" class="text-center text-muted py-3">No credited subjects yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>

      <h6 class="mb-2">Subjects Still To Take (full path to graduation)</h6>
      <div class="table-responsive">
        <table class="table table-sm">
          <thead><tr><th>Year</th><th>Semester</th><th>Code</th><th>Subject</th><th>Units</th><th>Prerequisite</th><th>Why not credited</th></tr></thead>
          <tbody>
            ${
              stillToTakeRows.length
                ? stillToTakeRows
                    .map(
                      (s) => `
                <tr>
                  <td class="text-nowrap">${escapeHtml(s.yearLevel)}</td>
                  <td class="text-nowrap">${escapeHtml(s.semester)}</td>
                  <td class="text-nowrap">${escapeHtml(s.subjectCode)}</td>
                  <td>${escapeHtml(s.subjectName)}</td>
                  <td>${escapeHtml(s.units)}</td>
                  <td class="text-nowrap">${escapeOrDash(s.prerequisite)}</td>
                  <td class="small">${getNotCreditedReason(s, creditedMap, requiredSubjectsById)}</td>
                </tr>`
                    )
                    .join("")
                : `<tr><td colspan="7" class="text-center text-muted py-3">${requiredSubjects.length ? "All required subjects are credited." : "No required subjects to display yet."}</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </div>`;
}
