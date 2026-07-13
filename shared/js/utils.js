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

// ==================== Credit Evaluation shared helpers ====================
// Used by both Admin Evaluations (admin-evaluations.js) and the student's
// own read-only Credit Evaluation page (student-evaluations.js).

const YEAR_ORDER = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

// A subject counts toward a student's plan if it's Active, its curriculum
// matches the student's (missing curriculum on legacy subjects is treated
// as "New"), and its track matches the student's track, is "All Tracks", or
// is unset (legacy subjects created before the Track field existed apply to
// every track).
function getRequiredSubjects(student, allSubjectsArr) {
  const studentCurriculum = student.curriculum || "New";
  return allSubjectsArr.filter((s) => {
    const subjCurriculum = s.curriculum || "New";
    const matchesCurriculum = subjCurriculum === studentCurriculum;
    const matchesTrack = !s.track || s.track === student.track || s.track === "All Tracks";
    const isActive = (s.status || "Active") === "Active";
    return matchesCurriculum && matchesTrack && isActive;
  });
}

function buildCreditedMap(creditedDocs) {
  const map = new Map();
  creditedDocs.forEach((c) => map.set(c.subjectId, c));
  return map;
}

function computeCreditProgress(requiredSubjects, creditedMap) {
  const perYear = {};
  YEAR_ORDER.forEach((y) => (perYear[y] = { creditedUnits: 0, requiredUnits: 0 }));

  let totalCreditedUnits = 0;
  let totalRequiredUnits = 0;

  requiredSubjects.forEach((s) => {
    const bucket = perYear[s.yearLevel] || (perYear[s.yearLevel] = { creditedUnits: 0, requiredUnits: 0 });
    const units = Number(s.units) || 0;
    bucket.requiredUnits += units;
    totalRequiredUnits += units;
    if (creditedMap.has(s.id)) {
      bucket.creditedUnits += units;
      totalCreditedUnits += units;
    }
  });

  const overallPercent = totalRequiredUnits > 0 ? Math.round((totalCreditedUnits / totalRequiredUnits) * 100) : 0;

  return {
    perYear,
    totalCreditedUnits,
    totalRequiredUnits,
    remainingUnits: Math.max(0, totalRequiredUnits - totalCreditedUnits),
    overallPercent
  };
}

function getNotCreditedReason(subject, creditedMap, requiredSubjectsById) {
  const prereqText = (subject.prerequisite || "").trim();
  if (!prereqText) return "Not yet credited.";

  // Prerequisite field may list more than one code, e.g. "IT 221, IT 222".
  const prereqCodes = prereqText.split(",").map((c) => c.trim()).filter(Boolean);

  for (const code of prereqCodes) {
    const prereqSubject = Object.values(requiredSubjectsById).find((s) => s.subjectCode === code);
    if (!prereqSubject) {
      return `Not yet credited. (Prerequisite "${escapeHtml(code)}" not found in curriculum.)`;
    }
    if (!creditedMap.has(prereqSubject.id)) {
      return `Requires prerequisite "${escapeHtml(prereqSubject.subjectCode)} - ${escapeHtml(prereqSubject.subjectName)}" to be completed first.`;
    }
  }
  return "Not yet credited.";
}

function renderProgressRingSvg(percent) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return `
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#e9ecef" stroke-width="12" />
      <circle cx="70" cy="70" r="${radius}" fill="none" stroke="#0d6efd" stroke-width="12"
        stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
        transform="rotate(-90 70 70)" />
      <text x="70" y="65" text-anchor="middle" font-size="24" font-weight="700">${percent}%</text>
      <text x="70" y="86" text-anchor="middle" font-size="11" fill="#6c757d">of units</text>
    </svg>`;
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
