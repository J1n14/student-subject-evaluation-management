// Requires db, auth, serverTimestamp (from firebase-config.js) loaded first.

function ensureToastContainer() {
  let el = document.getElementById("toast-container");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast-container";
    el.className = "toast-container position-fixed top-0 end-0 p-3";
    el.style.zIndex = 1080;
    document.body.appendChild(el);
  }
  return el;
}

function showToast(message, type = "success") {
  const container = ensureToastContainer();
  const bg = { success: "bg-success", error: "bg-danger", warning: "bg-warning", info: "bg-info" }[type] || "bg-success";
  const textClass = type === "warning" ? "text-dark" : "text-white";
  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center ${textClass} ${bg} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close ${type !== "warning" ? "btn-close-white" : ""} me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
  toast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

function showError(err, fallback = "Something went wrong.") {
  console.error(err);
  showToast(err && err.message ? err.message : fallback, "error");
}

function formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status) {
  const map = {
    Graduated: "bg-success",
    "In Progress": "bg-info text-dark",
    Pending: "bg-warning text-dark",
    Active: "bg-success",
    Inactive: "bg-secondary"
  };
  const cls = map[status] || "bg-secondary";
  return `<span class="badge ${cls}">${status}</span>`;
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeOrDash(str) {
  return str ? escapeHtml(str) : "-";
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

async function logActivity(action) {
  try {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection("activityLogs").add({
      userId: user.uid,
      email: user.email,
      action,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.warn("Failed to log activity:", err);
  }
}

function paginate(items, page, pageSize) {
  const start = (page - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    total: items.length
  };
}

function renderPagination(containerEl, currentPage, totalPages, onPageChange) {
  containerEl.innerHTML = "";
  if (totalPages <= 1) return;
  const ul = document.createElement("ul");
  ul.className = "pagination pagination-sm mb-0";
  for (let p = 1; p <= totalPages; p++) {
    const li = document.createElement("li");
    li.className = `page-item ${p === currentPage ? "active" : ""}`;
    li.innerHTML = `<button type="button" class="page-link">${p}</button>`;
    li.querySelector("button").addEventListener("click", () => onPageChange(p));
    ul.appendChild(li);
  }
  containerEl.appendChild(ul);
}

function validateForm(formEl) {
  formEl.classList.add("was-validated");
  return formEl.checkValidity();
}

// ---------- Login page helpers (password visibility + forgot password) ----------
function togglePasswordVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  const nowHidden = input.type === "password";
  input.type = nowHidden ? "text" : "password";
  const icon = btn.querySelector("i");
  if (icon) {
    icon.classList.toggle("bi-eye", !nowHidden);
    icon.classList.toggle("bi-eye-slash", nowHidden);
  }
}

async function handleForgotPassword(emailInputId) {
  const email = (document.getElementById(emailInputId).value || "").trim();
  if (!email) {
    showToast("Enter your email address above first, then click Forgot Password.", "warning");
    return;
  }
  try {
    await auth.sendPasswordResetEmail(email);
    showToast("Password reset email sent - check your inbox.");
  } catch (err) {
    showError(err, "Could not send the reset email. Double-check the address.");
  }
}

// ==================== Credit Evaluation shared helpers ====================
// Used by both Admin Evaluations (admin-evaluations.js) and the student's
// own read-only Credit Evaluation page (student-evaluations.js).

const YEAR_ORDER = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// A subject counts toward a student's plan if it's Active, its curriculum
// matches the student's (missing curriculum on legacy subjects is treated
// as "New"), and its track matches the student's track, is "General"
// (applies to every track - "All Tracks" is the pre-rename legacy value for
// the same thing), or is unset (legacy subjects created before the Track
// field existed apply to every track).
function getRequiredSubjects(student, allSubjectsArr) {
  const studentCurriculum = student.curriculum || "New";
  return allSubjectsArr.filter((s) => {
    const subjCurriculum = s.curriculum || "New";
    const matchesCurriculum = subjCurriculum === studentCurriculum;
    const matchesTrack = !s.track || s.track === student.track || s.track === "General" || s.track === "All Tracks";
    const isActive = (s.status || "Active") === "Active";
    return matchesCurriculum && matchesTrack && isActive;
  });
}

function buildCreditedMap(creditedDocs) {
  const map = new Map();
  creditedDocs.forEach((c) => map.set(c.subjectId, c));
  return map;
}

// ==================== Prerequisite checking (single shared rule) ====================
// Crediting a subject - whether it was earned at Nexus or brought in from
// another school via the "Credited From" note on a credited-subject record
// - never automatically credits that subject's OWN prerequisite too. The
// prerequisite is a separate subject and still needs its own credited
// record if the student needs it. Nothing in this codebase cascades a
// credit from a subject to its prerequisite, by design; this helper is the
// one place that decides "is this subject's prerequisite satisfied", reused
// by both the Assignment page's picker and the Evaluation page's mark-
// credited flow so the rule can't drift between the two.
//
// Looks up prerequisite codes against the FULL subject catalog (not just
// subjects required by one student's curriculum/track), since a
// transferee/irregular student's prerequisite may sit in a different
// year/track than the subject that needs it.
//
// Returns an array of { code, name, id } for prerequisites NOT yet in
// creditedMap. Empty array = fully satisfied (credited anywhere, Nexus or
// another school - the source doesn't matter, only that a credited record
// exists for it).
function getUnmetPrerequisites(subject, creditedMap, allSubjectsArr) {
  const text = (subject.prerequisite || "").trim();
  if (!text) return [];
  const codes = text.split(",").map((c) => c.trim()).filter(Boolean);
  const missing = [];
  for (const code of codes) {
    const pre = allSubjectsArr.find((s) => s.subjectCode === code);
    if (!pre) {
      missing.push({ code, name: null, id: null }); // prerequisite code not found in the catalog at all
    } else if (!creditedMap.has(pre.id)) {
      missing.push({ code: pre.subjectCode, name: pre.subjectName, id: pre.id });
    }
  }
  return missing;
}

function getNotCreditedReason(subject, creditedMap, allSubjectsArr) {
  const missing = getUnmetPrerequisites(subject, creditedMap, allSubjectsArr);
  if (!missing.length) return "Not yet credited.";
  const first = missing[0];
  return first.name
    ? `Requires prerequisite "${escapeHtml(first.code)} - ${escapeHtml(first.name)}" to be completed first.`
    : `Not yet credited. (Prerequisite "${escapeHtml(first.code)}" not found in curriculum.)`;
}

// Graduated: every required subject (per curriculum+track) is credited.
// In Progress: at least one required subject is credited, but not all.
// Pending: no required subjects defined yet, or none credited yet.
async function recomputeCreditStatus(studentId) {
  const studentDoc = await db.collection("students").doc(studentId).get();
  if (!studentDoc.exists) return "Pending";
  const student = studentDoc.data();

  const [subjectsSnap, creditedSnap] = await Promise.all([
    db.collection("subjects").get(),
    db.collection("creditedSubjects").where("studentId", "==", studentId).get()
  ]);

  const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const required = getRequiredSubjects(student, allSubjects);
  const creditedIds = new Set(creditedSnap.docs.map((d) => d.data().subjectId));

  let status;
  if (required.length === 0) {
    status = "Pending";
  } else {
    const creditedCount = required.filter((s) => creditedIds.has(s.id)).length;
    status = creditedCount === required.length ? "Graduated" : creditedCount > 0 ? "In Progress" : "Pending";
  }

  await db.collection("students").doc(studentId).update({ status, updatedAt: serverTimestamp() });
  return status;
}

// Evaluate a student's readiness to enroll for the current term.
// Returns an object summarizing curriculum, completed/pending subjects,
// unmet prerequisites, availability per current term, standing issues,
// and unit policy limits.
async function evaluateStudentEnrollmentReadiness(studentId) {
  const studentDoc = await db.collection("students").doc(studentId).get();
  if (!studentDoc.exists) return { error: "Student not found" };
  const student = studentDoc.data();

  const [subjectsSnap, creditedSnap, termDoc, unitDoc] = await Promise.all([
    db.collection("subjects").get(),
    db.collection("creditedSubjects").where("studentId", "==", studentId).get(),
    db.collection("settings").doc("currentTerm").get(),
    db.collection("settings").doc("unitPolicy").get()
  ]);

  const allSubjects = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const creditedIds = new Set(creditedSnap.docs.map((d) => d.data().subjectId));

  const required = getRequiredSubjects(student, allSubjects);
  const completed = required.filter((s) => creditedIds.has(s.id));
  const pending = required.filter((s) => !creditedIds.has(s.id));

  const currentTerm = termDoc.exists ? termDoc.data() : { academicYear: "", semester: "" };
  const unitPolicyDoc = unitDoc.exists ? unitDoc.data() : { minUnits: null, maxUnits: null };

  // Helper to compute missing prereqs for a subject within the student's required plan
  function missingPrerequisitesFor(subject) {
    const text = (subject.prerequisite || "").trim();
    if (!text) return [];
    const codes = text.split(",").map((c) => c.trim()).filter(Boolean);
    const missing = [];
    for (const code of codes) {
      const prereq = required.find((r) => r.subjectCode === code);
      if (!prereq) missing.push(code);
      else if (!creditedIds.has(prereq.id)) missing.push(code);
    }
    return missing;
  }

  const pendingDetails = pending.map((s) => {
    const missingPrereqs = missingPrerequisitesFor(s);
    const termMismatch = (currentTerm.academicYear && s.academicYear && String(s.academicYear) !== String(currentTerm.academicYear)) ||
      (currentTerm.semester && s.semester && String(s.semester) !== String(currentTerm.semester));
    const eligibility = [];
    if (student?.academicHold) eligibility.push("academic hold");
    const minGpa = Number(s.minGpa);
    const studentGpa = Number(student?.gpa);
    if (!Number.isNaN(minGpa) && minGpa > 0 && !Number.isNaN(studentGpa) && studentGpa < minGpa) eligibility.push(`requires GPA ${minGpa}`);
    if (s.requiredStanding && student?.academicStanding && String(s.requiredStanding) !== String(student.academicStanding)) eligibility.push(`requires ${s.requiredStanding}`);
    return {
      id: s.id,
      code: s.subjectCode,
      name: s.subjectName,
      missingPrereqs,
      availableThisTerm: !termMismatch,
      eligibilityIssues: eligibility
    };
  });

  return {
    student: { id: studentId, name: student.fullName, curriculum: student.curriculum || "New", track: student.track },
    curriculumSubjectsCount: required.length,
    completedCount: completed.length,
    pendingCount: pending.length,
    pendingDetails,
    currentTerm: currentTerm,
    unitPolicy: { minUnits: unitPolicyDoc.minUnits || null, maxUnits: unitPolicyDoc.maxUnits || null }
  };
}
