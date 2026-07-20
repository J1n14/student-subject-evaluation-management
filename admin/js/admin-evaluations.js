let evalStudents = [];
let subjectsCatalogCache = null;
let currentSelectedStudentId = null;
let creditTabState = null; // { student, requiredSubjects, requiredSubjectsById, creditedMap }

async function initAdminEvaluations(content) {
  content.innerHTML = `
    <div class="section-card mb-3">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-primary rounded-pill me-1">1</span>Select Student</label>
      <div class="position-relative">
        <input type="text" class="form-control" id="eval-student-search" placeholder="Search by name or email..." autocomplete="off" />
        <div class="list-group position-absolute w-100 mt-1" id="eval-student-search-results" style="display:none;"></div>
      </div>
      <div id="eval-selected-student-chip" class="mt-2"></div>
    </div>

    <div class="section-card" id="eval-section" style="display:none">
      <label class="form-label fw-semibold mb-2"><span class="badge bg-primary rounded-pill me-1">2</span>Credit Evaluation</label>
      <div id="credit-evaluation-panel"></div>
    </div>

    <div class="modal fade" id="creditModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="creditModalTitle">Add Credited Subject</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <form id="credit-form" class="needs-validation" novalidate>
            <div class="modal-body">
              <input type="hidden" id="creditDocId" />
              <div class="alert alert-info small">
                Only passing grades from <strong>1.00</strong> to <strong>3.00</strong> are accepted for credited subjects.
              </div>
              <div class="mb-3">
                <label class="form-label">Subject</label>
                <select class="form-select" id="creditSubjectId" required>
                  <option value="">Select subject</option>
                </select>
                <div class="invalid-feedback">Select a subject.</div>
                <div class="alert alert-warning small mt-2 mb-0 py-2" id="creditPrereqNote" style="display:none"></div>
              </div>
              <div class="mb-3">
                <label class="form-label">Credited From (old school course)</label>
                <input type="text" class="form-control" id="creditedFrom" placeholder="e.g. GE 1102 - Mathematics in the Modern World" required />
                <div class="invalid-feedback">Required.</div>
                <div class="form-text" id="creditedFromHint"></div>
              </div>
              <div class="mb-3">
                <label class="form-label">Grade</label>
                <input type="number" class="form-control" id="creditGrade" step="0.01" min="1" max="3" placeholder="e.g. 1.00" required />
                <div class="invalid-feedback">Enter a passing grade between 1.00 and 3.00.</div>
                <div class="form-text">A subject is considered passed when the grade is between 1.00 and 3.00.</div>
              </div>
              <div class="mb-3">
                <label class="form-label">Remarks</label>
                <input type="text" class="form-control" id="creditRemarks" placeholder="Optional" />
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary" id="credit-save-btn">Save</button>
            </div>
          </form>
        </div>
      </div>
    </div>`;

  document.getElementById("eval-student-search").addEventListener("input", debounce(renderEvalStudentSearchResults, 150));
  document.getElementById("eval-student-search").addEventListener("focus", renderEvalStudentSearchResults);
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#eval-student-search") && !e.target.closest("#eval-student-search-results")) {
      const results = document.getElementById("eval-student-search-results");
      if (results) results.style.display = "none";
    }
  });
  document.getElementById("credit-form").addEventListener("submit", saveCreditedSubject);
  document.getElementById("creditSubjectId").addEventListener("change", updateCreditedFromHint);
  document.getElementById("creditedFrom").addEventListener("input", debounce(() => updateCreditedFromHint({ keepValue: true }), 400));

  const snap = await db.collection("students").orderBy("fullName").get();
  evalStudents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

function renderEvalStudentSearchResults() {
  const input = document.getElementById("eval-student-search");
  const search = input.value.toLowerCase().trim();
  const results = document.getElementById("eval-student-search-results");

  const matches = evalStudents
    .filter((s) => !search || s.fullName.toLowerCase().includes(search) || (s.email || "").toLowerCase().includes(search))
    .slice(0, 8);

  results.innerHTML = matches.length
    ? matches
        .map(
          (s) => `<button type="button" class="list-group-item list-group-item-action" onclick="pickStudentForEvaluation('${s.id}')">
        <div class="d-flex justify-content-between">
          <span>${escapeHtml(s.fullName)}</span>
          ${statusBadge(s.status || "Pending")}
        </div>
        <div class="small text-muted">${escapeHtml(s.email)} &middot; ${escapeOrDash(s.track)}</div>
      </button>`
        )
        .join("")
    : `<div class="list-group-item text-muted small">No students found.</div>`;
  results.style.display = "block";
}

function pickStudentForEvaluation(studentId) {
  document.getElementById("eval-student-search-results").style.display = "none";
  document.getElementById("eval-student-search").value = "";

  const s = evalStudents.find((x) => x.id === studentId);
  document.getElementById("eval-selected-student-chip").innerHTML = `
    <div class="selected-student-chip">
      <div>
        <strong>${escapeHtml(s.fullName)}</strong>
        <span class="text-muted small ms-2">${escapeHtml(s.email)}</span>
        <span class="ms-2">${statusBadge(s.status || "Pending")}</span>
      </div>
      <button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearSelectedEvaluationStudent()">
        <i class="bi bi-arrow-repeat me-1"></i>Change student
      </button>
    </div>`;

  document.getElementById("eval-section").style.display = "block";
  selectStudentForCreditEvaluation(studentId);
}

function clearSelectedEvaluationStudent() {
  currentSelectedStudentId = null;
  creditTabState = null;
  document.getElementById("eval-selected-student-chip").innerHTML = "";
  document.getElementById("eval-section").style.display = "none";
  document.getElementById("credit-evaluation-panel").innerHTML = "";
  const input = document.getElementById("eval-student-search");
  input.value = "";
  input.focus();
}

// ==================== Credit Evaluation ====================

async function getSubjectsCatalog() {
  if (subjectsCatalogCache) return subjectsCatalogCache;
  const snap = await db.collection("subjects").get();
  subjectsCatalogCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return subjectsCatalogCache;
}

let courseMatchExceptionsCache = null;
async function getCourseMatchExceptions() {
  if (courseMatchExceptionsCache) return courseMatchExceptionsCache;
  const snap = await db.collection("courseMatchExceptions").get();
  courseMatchExceptionsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return courseMatchExceptionsCache;
}

// Looks across all other subjects for a matching code and classifies the
// relationship so the credit form can react to it:
//   "exact"    - same code AND same name -> definitely the same course.
//                 "Credited From" isn't really needed in this case.
//   "accepted" - code matches, name differs, but an Admin already reviewed
//                 and accepted it as equivalent on the Course Matches page.
//   "pending"  - code matches, name differs, and nobody's reviewed it yet -
//                 flag it so the admin knows to go decide, but don't block
//                 crediting (could still be a genuine external-school TOR
//                 entry that just happens to share a code).
//   "rejected" - code matches, name differs, and an Admin already decided
//                 these are NOT the same course.
//   null       - no code overlap with any other subject at all.
function normalizeCourseMatchCode(code) {
  return String(code || "").trim().toUpperCase();
}

function findAcceptedCourseMatchByCode(subjectCode, exceptions) {
  const code = normalizeCourseMatchCode(subjectCode);
  if (!code) return null;
  return exceptions.find(
    (e) =>
      e.status === "accepted" &&
      (normalizeCourseMatchCode(e.oldCode) === code || normalizeCourseMatchCode(e.newCode) === code)
  );
}

// Given a courseMatchExceptions doc and the subject being credited, returns
// the code/name of the OTHER side of the pair (works whether `subject` is
// the old or new side, and whether the other side is a real catalog subject
// or an external/manual entry with no subjectId).
function otherSideOfException(subject, exception) {
  if (!exception) return { code: "", name: "" };
  if (exception.oldSubjectId === subject.id) return { code: exception.newCode, name: exception.newName };
  return { code: exception.oldCode, name: exception.oldName };
}

function hasTransferredSubjectCode(subjectCode) {
  const studentCodes = splitTransferredCodes(creditTabState?.student?.transferredSubjectCodes);
  const code = normalizeCourseMatchCode(subjectCode);
  return studentCodes.includes(code);
}

function splitTransferredCodes(value) {
  return String(value || "")
    .split(/[,;\n]+/)
    .map((c) => normalizeCourseMatchCode(c))
    .filter(Boolean);
}

async function ensurePendingCourseMatch(subject, equivalence) {
  if (!subject || !equivalence || equivalence.type !== "pending") return null;

  const code = normalizeCourseMatchCode(subject.subjectCode);
  if (!code || !hasTransferredSubjectCode(code)) return null;

  const candidate = equivalence.match;
  if (!candidate || normalizeCourseMatchCode(candidate.subjectCode) !== code) return null;

  const [firstSubject, secondSubject] = [subject, candidate].sort((a, b) => a.id.localeCompare(b.id));
  const docId = `${firstSubject.id}_${secondSubject.id}`;
  const ref = db.collection("courseMatchExceptions").doc(docId);
  const existing = await ref.get();
  if (existing.exists) return { id: existing.id, ...existing.data() };

  const data = {
    oldSubjectId: firstSubject.id,
    newSubjectId: secondSubject.id,
    oldCode: firstSubject.subjectCode,
    oldName: firstSubject.subjectName,
    newCode: secondSubject.subjectCode,
    newName: secondSubject.subjectName,
    status: "pending",
    detectedAt: serverTimestamp()
  };

  await ref.set(data);
  courseMatchExceptionsCache = null;
  return { id: docId, ...data };
}

function parseCreditedFromInput(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  // Expect formats like "CS 121 - ACP" or "CS121 : Advanced...". Split on dash/colon.
  const parts = text.split(/[-–—:]+/);
  if (parts.length < 2) return null;
  const code = parts[0].trim();
  const name = parts.slice(1).join("-").trim();
  if (!code) return null;
  return { code: normalizeCourseMatchCode(code), name };
}

async function createPendingExceptionFromExternal(subject, externalCode, externalName) {
  if (!subject || !externalCode) return null;
  const code = normalizeCourseMatchCode(subject.subjectCode);
  const exCode = normalizeCourseMatchCode(externalCode);

  // Check existing exceptions by code pair first
  const snap = await db.collection("courseMatchExceptions").get();
  const existing = snap.docs.map((d) => ({ id: d.id, ...d.data() })).find((e) => {
    return (
      normalizeCourseMatchCode(e.oldCode) === code && normalizeCourseMatchCode(e.newCode) === exCode
    ) || (
      normalizeCourseMatchCode(e.oldCode) === exCode && normalizeCourseMatchCode(e.newCode) === code
    );
  });
  if (existing) return existing;

  // Create deterministic id for this manual external pair
  const docId = `manual_${subject.id}_${exCode}`;
  const ref = db.collection("courseMatchExceptions").doc(docId);
  const data = {
    oldSubjectId: subject.id,
    newSubjectId: null,
    oldCode: subject.subjectCode,
    oldName: subject.subjectName,
    newCode: externalCode,
    newName: externalName || "(external)",
    status: "pending",
    detectedAt: serverTimestamp()
  };
  await ref.set(data, { merge: true });
  courseMatchExceptionsCache = null;
  return { id: docId, ...data };
}

function getCourseEquivalence(subject, allSubjects, exceptions) {
  if (!subject) return null;

  const candidates = allSubjects.filter(
    (s) =>
      s.id !== subject.id &&
      normalizeCourseMatchCode(s.subjectCode) === normalizeCourseMatchCode(subject.subjectCode)
  );
  if (candidates.length === 0) return null;

  const exact = candidates.find((s) => s.subjectName === subject.subjectName);
  if (exact) return { type: "exact", match: exact };

  for (const cand of candidates) {
    const [firstId, secondId] = [subject.id, cand.id].sort();
    const exception = exceptions.find(
      (e) =>
        (e.oldSubjectId === firstId && e.newSubjectId === secondId) ||
        (e.oldSubjectId === secondId && e.newSubjectId === firstId)
    );
    if (exception) return { type: exception.status, match: cand, exception };
  }
  return { type: "pending", match: candidates[0] }; // code overlap, name differs, never scanned/no exception doc yet
}

async function selectStudentForCreditEvaluation(studentId) {
  currentSelectedStudentId = studentId;
  const student = evalStudents.find((s) => s.id === studentId);
  const panel = document.getElementById("credit-evaluation-panel");
  panel.innerHTML = `<div class="text-muted small">Loading...</div>`;

  const [allSubjectsArr, creditedSnap, assignSnap] = await Promise.all([
    getSubjectsCatalog(),
    db.collection("creditedSubjects").where("studentId", "==", studentId).get(),
    db.collection("studentSubjects").where("studentId", "==", studentId).get()
  ]);

  const creditedDocs = creditedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const assignedDocs = assignSnap.docs.map((d) => d.data());
  const model = buildEvalModel(student, allSubjectsArr, creditedDocs, assignedDocs);

  creditTabState = {
    student,
    requiredSubjects: model.required,
    requiredSubjectsById: model.requiredById,
    creditedMap: model.creditedMap
  };

  renderCreditEvaluation(panel, { student, model, interactive: true });
}

// creditId: edit an existing record. preselectSubjectId: pre-choose a subject
// (used by the "Mark credited" buttons in the grouped view).
async function openCreditModal(creditId, preselectSubjectId) {
  const form = document.getElementById("credit-form");
  form.classList.remove("was-validated");
  form.reset();
  document.getElementById("creditDocId").value = "";
  document.getElementById("creditModalTitle").textContent = "Add Credited Subject";
  document.getElementById("creditedFromHint").textContent = "";

  const { requiredSubjects, creditedMap } = creditTabState;
  const existingRecord = creditId ? [...creditedMap.values()].find((r) => r.id === creditId) : null;

  const eligible = requiredSubjects.filter(
    (s) => !creditedMap.has(s.id) || (existingRecord && s.id === existingRecord.subjectId)
  );

  const select = document.getElementById("creditSubjectId");
  if (eligible.length === 0) {
    select.innerHTML = `<option value="" disabled selected>No eligible subjects — add matching subjects first</option>`;
  } else {
    select.innerHTML =
      `<option value="">Select subject</option>` +
      eligible.map((s) => `<option value="${s.id}">${escapeHtml(s.subjectCode)} - ${escapeHtml(s.subjectName)}</option>`).join("");
  }

  if (existingRecord) {
    document.getElementById("creditModalTitle").textContent = "Edit Credited Subject";
    document.getElementById("creditDocId").value = existingRecord.id;
    select.value = existingRecord.subjectId;
    select.disabled = true;
    document.getElementById("creditedFrom").value = existingRecord.creditedFrom || "";
    document.getElementById("creditGrade").value = existingRecord.grade ?? "";
    document.getElementById("creditRemarks").value = existingRecord.remarks || "";
    await updateCreditedFromHint({ keepValue: true });
  } else {
    select.disabled = false;
    if (preselectSubjectId) select.value = preselectSubjectId;
    document.getElementById("creditGrade").value = "";
    await updateCreditedFromHint({ keepValue: false });
  }
}

// Reacts to the subject dropdown: looks up whether the selected subject has
// a known equivalent in the other curriculum and adjusts the "Credited
// From" field's requirement + explanatory hint accordingly. Only
// auto-fills the field (rather than just hinting) for a brand-new record
// with a genuine exact code+name match, and never overwrites text the
// admin already typed.
async function updateCreditedFromHint(opts = {}) {
  const subjectId = document.getElementById("creditSubjectId").value;
  const input = document.getElementById("creditedFrom");
  const hint = document.getElementById("creditedFromHint");
  if (!hint) return;

  if (!subjectId) {
    input.required = true;
    hint.textContent = "";
    hint.className = "form-text";
    return;
  }

  const [allSubjects, exceptions] = await Promise.all([getSubjectsCatalog(), getCourseMatchExceptions()]);
  const subject = allSubjects.find((s) => s.id === subjectId);
  const subjectCode = subject?.subjectCode || "";
  const transferredMatch = hasTransferredSubjectCode(subjectCode);
  const acceptedCodeMatch = findAcceptedCourseMatchByCode(subjectCode, exceptions);
  let equivalence = getCourseEquivalence(subject, allSubjects, exceptions);
  if (equivalence) equivalence.source = "catalog";

  // Strict rule: what the admin typed in "Credited From" is trusted as the
  // SAME course if and only if BOTH its code AND its name match this
  // subject 100%. Anything else - same code but a different name, or a
  // different code entirely - needs an admin to review and accept it as an
  // equivalent course in Course Matches before it can be used to credit
  // this subject (the actual block happens in saveCreditedSubject(); this
  // just surfaces the current status as a hint, and files a pending Course
  // Match if none exists yet).
  const creditedFromRaw = document.getElementById("creditedFrom").value;
  const parsed = parseCreditedFromInput(creditedFromRaw);
  const isExactTypedMatch = parsed && parsed.code === normalizeCourseMatchCode(subjectCode) && parsed.name === subject.subjectName;
  if (parsed && !isExactTypedMatch) {
    const match = await createPendingExceptionFromExternal(subject, parsed.code, parsed.name);
    if (match) {
      courseMatchExceptionsCache = null;
      equivalence = { type: match.status, match: null, exception: match, source: "typed" };
    }
  }

  if (equivalence && equivalence.type === "pending" && equivalence.source === "catalog") {
    const pending = await ensurePendingCourseMatch(subject, equivalence);
    if (pending) {
      courseMatchExceptionsCache = null;
      equivalence = { type: "pending", match: equivalence.match, exception: pending, source: "catalog" };
    }
  }

  if (transferredMatch && acceptedCodeMatch) {
    input.required = true;
    hint.textContent = `This code is listed among the student's transferred subjects and has an accepted Course Match (${acceptedCodeMatch.oldCode} / ${acceptedCodeMatch.newCode}). Specify the source below.`;
    hint.className = "form-text text-success";
    return;
  }

  if (!equivalence) {
    input.required = true;
    if (transferredMatch) {
      hint.textContent = `This code is on the student's transferred list. If the external course name differs, review the match in Course Matches and accept the code before crediting it.`;
      hint.className = "form-text text-info";
    } else {
      hint.textContent = "";
      hint.className = "form-text";
    }
    return;
  }

  const other = equivalence.match
    ? { code: equivalence.match.subjectCode, name: equivalence.match.subjectName }
    : otherSideOfException(subject, equivalence.exception);

  if (equivalence.type === "exact") {
    input.required = false;
    if (!opts.keepValue && !input.value.trim()) {
      // No suffix note here - the value round-trips through
      // parseCreditedFromInput()/isExactTypedMatch on every future edit, and
      // an appended note would make the name stop matching the subject's own
      // name exactly, incorrectly flagging an already-exact match as pending.
      input.value = `${equivalence.match.subjectCode} - ${equivalence.match.subjectName}`;
    }
    hint.textContent = "Same course, code + name match with the other curriculum — no need to fill this in unless you want to add a note.";
    hint.className = "form-text text-success";
  } else if (equivalence.type === "accepted") {
    input.required = true;
    hint.textContent = `Accepted as equivalent to ${other.code} - ${other.name} (reviewed in Course Matches). Specify where it was actually taken below.`;
    hint.className = "form-text text-muted";
  } else if (equivalence.type === "rejected") {
    input.required = true;
    if (equivalence.source === "typed") {
      hint.innerHTML = `This entry was reviewed and rejected as equivalent to <strong>${escapeHtml(subject.subjectCode)} - ${escapeHtml(subject.subjectName)}</strong> in Course Matches, so it can't be used to credit this subject. Fix the "Credited From" entry, or resolve it in <a href="admin-course-matches.html" target="_blank">Course Matches</a>.`;
      hint.className = "form-text text-danger";
    } else {
      hint.textContent = `Note: reviewed and rejected as equivalent to "${other.name}" in Course Matches — treat this as a separate course.`;
      hint.className = "form-text text-muted";
    }
  } else {
    // pending
    input.required = true;
    if (equivalence.source === "typed") {
      hint.innerHTML = `⚠️ "${escapeHtml(other.code)} - ${escapeHtml(other.name)}" isn't a confirmed match for this subject yet, so it can't be used to credit it. Review and accept the match in <a href="admin-course-matches.html" target="_blank">Course Matches</a> first, or fix the "Credited From" entry if this was a mistake.`;
    } else {
      hint.innerHTML = `⚠️ This code also exists as "${escapeHtml(other.name)}" in the other curriculum, not yet reviewed. If this is the same course carried over, review and accept the match in <a href="admin-course-matches.html" target="_blank">Course Matches</a>, then come back to credit it. Otherwise, specify below where it was actually taken (e.g. a different school).`;
    }
    hint.className = "form-text text-warning";
  }

  updateCreditPrereqNote();
}

// Crediting a subject (whether it was completed at Nexus or brought in from
// another school, per the "Credited From" note) never automatically credits
// that subject's OWN prerequisite - the prerequisite is a separate subject
// and still needs its own credited record if the student needs it. This
// just makes that rule visible at the moment an admin picks a subject to
// credit, instead of leaving it implicit.
function updateCreditPrereqNote() {
  const note = document.getElementById("creditPrereqNote");
  const subjectId = document.getElementById("creditSubjectId").value;
  if (!subjectId || !creditTabState) {
    note.style.display = "none";
    return;
  }

  const subject = (subjectsCatalogCache || []).find((s) => s.id === subjectId);
  if (!subject) {
    note.style.display = "none";
    return;
  }

  const missing = getUnmetPrerequisites(subject, creditTabState.creditedMap, subjectsCatalogCache || []);
  if (!missing.length) {
    note.style.display = "none";
    return;
  }

  const list = missing
    .map((m) => (m.name ? `<strong>${escapeHtml(m.code)} - ${escapeHtml(m.name)}</strong>` : `<strong>${escapeHtml(m.code)}</strong> (not found in catalog)`))
    .join(", ");
  note.innerHTML = `<i class="bi bi-info-circle me-1"></i>Note: ${escapeHtml(subject.subjectCode)} has its own prerequisite - ${list} - which is not yet credited. Crediting ${escapeHtml(subject.subjectCode)} here does not automatically credit it. If the student still needs it, credit or assign it separately.`;
  note.style.display = "block";
}

async function saveCreditedSubject(e) {
  e.preventDefault();
  const form = e.target;
  if (!validateForm(form)) return;

  const { student } = creditTabState;
  const subjectId = document.getElementById("creditSubjectId").value;
  const btn = document.getElementById("credit-save-btn");
  btn.disabled = true;

  try {
    const gradeValue = document.getElementById("creditGrade").value.trim();
    const grade = Number(gradeValue);
    if (!gradeValue || Number.isNaN(grade) || grade < 1 || grade > 3) {
      showToast("Enter a valid passing grade between 1.00 and 3.00.", "error");
      btn.disabled = false;
      return;
    }

    const currentCreditedFrom = document.getElementById("creditedFrom").value;
    const [allSubjects, exceptions] = await Promise.all([getSubjectsCatalog(), getCourseMatchExceptions()]);
    const subject = allSubjects.find((s) => s.id === subjectId);
    const equivalence = getCourseEquivalence(subject, allSubjects, exceptions);

    // Strict rule: credit only if the typed "Credited From" course matches
    // this subject's code AND name 100%. Any mismatch (code, name, or both)
    // goes to pending in Course Matches and blocks saving until an admin
    // accepts it there.
    const parsed = parseCreditedFromInput(currentCreditedFrom);
    const isExactTypedMatch = parsed && parsed.code === normalizeCourseMatchCode(subject?.subjectCode) && parsed.name === subject?.subjectName;
    if (parsed && !isExactTypedMatch) {
      const match = await createPendingExceptionFromExternal(subject, parsed.code, parsed.name);
      if (!match || match.status !== "accepted") {
        document.getElementById("creditedFrom").value = currentCreditedFrom;
        showToast(
          match?.status === "rejected"
            ? "This course was already reviewed and rejected as equivalent in Course Matches — it can't be used to credit this subject."
            : "This credited-from course isn't a confirmed match for this subject yet. Review and accept it in Course Matches before crediting.",
          "error"
        );
        btn.disabled = false;
        return;
      }
    }

    if (equivalence?.type === "pending") {
      await ensurePendingCourseMatch(subject, equivalence);
      document.getElementById("creditedFrom").value = currentCreditedFrom;
      showToast(
        "This subject has a same-code/different-name candidate. Review and accept the Course Match before crediting.",
        "error"
      );
      btn.disabled = false;
      return;
    }

    const docId = `${student.id}_${subjectId}`;
    await db.collection("creditedSubjects").doc(docId).set(
      {
        studentId: student.id,
        subjectId,
        creditedFrom: document.getElementById("creditedFrom").value.trim(),
        grade,
        remarks: document.getElementById("creditRemarks").value.trim(),
        creditedBy: auth.currentUser.email,
        creditedAt: serverTimestamp()
      },
      { merge: true }
    );

    await logActivity(`Saved credited subject for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Credited subject saved. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    bootstrap.Modal.getInstance(document.getElementById("creditModal")).hide();
    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to save credited subject.");
  } finally {
    btn.disabled = false;
  }
}

// Bulk-credits every required subject the selected student hasn't been
// credited for yet, in one batched write. Useful for quickly clearing an
// old-curriculum carryover instead of clicking "Mark credited" one by one.
// Each record still gets its own deterministic ID (studentId_subjectId), so
// it's safe to run again later - already-credited subjects are skipped.
async function markAllCredited() {
  if (!creditTabState) return;
  const { student, requiredSubjects, creditedMap } = creditTabState;
  const remaining = requiredSubjects.filter((s) => !creditedMap.has(s.id));

  if (remaining.length === 0) {
    showToast("Nothing left to credit for this student.", "info");
    return;
  }

  if (!confirm(`Mark all ${remaining.length} remaining subject(s) as credited for ${student.fullName}? This can be undone individually afterward if needed.`)) {
    return;
  }

  const rawInput = prompt('"Credited From" note to apply to all of them (e.g. old school / bulk carryover):', "Bulk credited by admin");
  if (rawInput === null) return; // admin cancelled
  const creditedFrom = rawInput.trim();
  const rawGrade = prompt('Enter a passing grade to apply to all of them (1.00 - 3.00):', '1.00');
  if (rawGrade === null) return;
  const grade = Number(rawGrade);
  if (!rawGrade.trim() || Number.isNaN(grade) || grade < 1 || grade > 3) {
    showToast('Bulk credit cancelled. Enter a valid passing grade between 1.00 and 3.00.', 'error');
    return;
  }

  try {
    const batch = db.batch();
    remaining.forEach((sub) => {
      const ref = db.collection("creditedSubjects").doc(`${student.id}_${sub.id}`);
      batch.set(
        ref,
        {
          studentId: student.id,
          subjectId: sub.id,
          creditedFrom: creditedFrom || "Bulk credited by admin",
          grade,
          remarks: "Marked via Mark All Credited",
          creditedBy: auth.currentUser.email,
          creditedAt: serverTimestamp()
        },
        { merge: true }
      );
    });
    await batch.commit();

    await logActivity(`Bulk-credited ${remaining.length} subject(s) for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Marked ${remaining.length} subject(s) as credited. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to bulk-credit subjects.");
  }
}

// Bulk-removes every credited record the selected student currently has for
// their required subjects, in one batched write - the reverse of Mark All
// Credited. Relies on the deterministic creditedSubjects doc ID
// (studentId_subjectId, same convention used everywhere else this
// collection is written), so no lookup of the record's own ID is needed.
async function unmarkAllCredited() {
  if (!creditTabState) return;
  const { student, requiredSubjects, creditedMap } = creditTabState;
  const currentlyCredited = requiredSubjects.filter((s) => creditedMap.has(s.id));

  if (currentlyCredited.length === 0) {
    showToast("Nothing credited yet for this student.", "info");
    return;
  }

  if (!confirm(`Unmark all ${currentlyCredited.length} credited subject(s) for ${student.fullName}? This removes their credited records entirely.`)) {
    return;
  }

  try {
    const batch = db.batch();
    currentlyCredited.forEach((sub) => {
      batch.delete(db.collection("creditedSubjects").doc(`${student.id}_${sub.id}`));
    });
    await batch.commit();

    await logActivity(`Bulk-unmarked ${currentlyCredited.length} credited subject(s) for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Unmarked ${currentlyCredited.length} subject(s). Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to unmark subjects.");
  }
}

// Credits only the subjects currently ticked via the per-row selection
// checkboxes (ignores any selected subject that's already credited).
async function markSelectedCredited() {
  if (!creditTabState) return;
  const { student, requiredSubjects, creditedMap } = creditTabState;
  const selectedIds = new Set(getEvalSelectedSubjectIds());
  const toCredit = requiredSubjects.filter((s) => selectedIds.has(s.id) && !creditedMap.has(s.id));

  if (toCredit.length === 0) {
    showToast("None of the selected subjects need crediting.", "info");
    return;
  }

  const preview = toCredit
    .slice(0, 8)
    .map((s) => s.subjectCode)
    .join(", ");
  const previewSuffix = toCredit.length > 8 ? `, +${toCredit.length - 8} more` : "";
  if (!confirm(`Mark ${toCredit.length} selected subject(s) as credited for ${student.fullName}?\n\n${preview}${previewSuffix}`)) return;

  const rawInput = prompt('"Credited From" note to apply to the selected subject(s):', "Credited by admin");
  if (rawInput === null) return; // admin cancelled
  const creditedFrom = rawInput.trim();
  const rawGrade = prompt('Enter a passing grade to apply to all of them (1.00 - 3.00):', '1.00');
  if (rawGrade === null) return;
  const grade = Number(rawGrade);
  if (!rawGrade.trim() || Number.isNaN(grade) || grade < 1 || grade > 3) {
    showToast('Selection cancelled. Enter a valid passing grade between 1.00 and 3.00.', 'error');
    return;
  }

  try {
    const batch = db.batch();
    toCredit.forEach((sub) => {
      const ref = db.collection("creditedSubjects").doc(`${student.id}_${sub.id}`);
      batch.set(
        ref,
        {
          studentId: student.id,
          subjectId: sub.id,
          creditedFrom: creditedFrom || "Credited by admin",
          grade,
          remarks: "Marked via selection",
          creditedBy: auth.currentUser.email,
          creditedAt: serverTimestamp()
        },
        { merge: true }
      );
    });
    await batch.commit();

    await logActivity(`Credited ${toCredit.length} selected subject(s) for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Marked ${toCredit.length} selected subject(s) as credited. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    clearEvalSelection();
    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to credit selected subjects.");
  }
}

// Removes credited records only for the subjects currently ticked via the
// per-row selection checkboxes (ignores any selected subject that isn't
// credited yet).
async function unmarkSelectedCredited() {
  if (!creditTabState) return;
  const { student, requiredSubjects, creditedMap } = creditTabState;
  const selectedIds = new Set(getEvalSelectedSubjectIds());
  const toUnmark = requiredSubjects.filter((s) => selectedIds.has(s.id) && creditedMap.has(s.id));

  if (toUnmark.length === 0) {
    showToast("None of the selected subjects are currently credited.", "info");
    return;
  }

  if (!confirm(`Unmark ${toUnmark.length} selected subject(s) for ${student.fullName}?`)) return;

  try {
    const batch = db.batch();
    toUnmark.forEach((sub) => {
      batch.delete(db.collection("creditedSubjects").doc(`${student.id}_${sub.id}`));
    });
    await batch.commit();

    await logActivity(`Unmarked ${toUnmark.length} selected subject(s) for student ${student.id}`);
    const newStatus = await recomputeCreditStatus(student.id);
    showToast(`Unmarked ${toUnmark.length} selected subject(s). Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === student.id);
    if (idx > -1) evalStudents[idx].status = newStatus;

    clearEvalSelection();
    await selectStudentForCreditEvaluation(student.id);
  } catch (err) {
    showError(err, "Failed to unmark selected subjects.");
  }
}

async function deleteCreditedSubject(creditId, studentId) {
  if (!confirm("Remove this credited subject?")) return;
  try {
    await db.collection("creditedSubjects").doc(creditId).delete();
    await logActivity(`Removed credited subject for student ${studentId}`);
    const newStatus = await recomputeCreditStatus(studentId);
    showToast(`Credited subject removed. Student status: ${newStatus}.`);

    const idx = evalStudents.findIndex((s) => s.id === studentId);
    if (idx > -1) evalStudents[idx].status = newStatus;

    await selectStudentForCreditEvaluation(studentId);
  } catch (err) {
    showError(err, "Failed to remove credited subject.");
  }
}