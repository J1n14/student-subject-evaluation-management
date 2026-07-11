/**
 * Shared utility helpers used across Admin and Student modules.
 * Requires: db, auth, serverTimestamp (from firebase-config.js) to be loaded first.
 */

// ---------- Toast notifications ----------
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

// ---------- Formatting ----------
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
    Evaluated: "bg-success",
    Pending: "bg-warning text-dark",
    Active: "bg-success",
    Inactive: "bg-secondary",
    "Needs Review": "bg-danger",
    Passed: "bg-success",
    Failed: "bg-danger",
    Incomplete: "bg-warning text-dark"
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

function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ---------- Activity logs ----------
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

// ---------- Simple client-side pagination ----------
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

// ---------- Form validation helper ----------
function validateForm(formEl) {
  formEl.classList.add("was-validated");
  return formEl.checkValidity();
}

// ---------- Automatic evaluation status ----------
/**
 * Recomputes a student's Evaluated/Pending/Needs Review status based on
 * their assigned subjects vs. saved evaluations, then writes it back.
 *   - All assigned subjects have an evaluation  -> "Evaluated"
 *   - Some assigned subjects missing evaluation -> "Pending"
 *   - Evaluations exist for subjects not currently assigned (data drift) -> "Needs Review"
 */
async function recomputeStudentStatus(studentId) {
  const [assignSnap, evalSnap] = await Promise.all([
    db.collection("studentSubjects").where("studentId", "==", studentId).get(),
    db.collection("evaluations").where("studentId", "==", studentId).get()
  ]);

  const assignedSubjectIds = new Set(assignSnap.docs.map((d) => d.data().subjectId));
  const evaluatedSubjectIds = new Set(evalSnap.docs.map((d) => d.data().subjectId));

  let status;
  const orphanEvaluations = [...evaluatedSubjectIds].some((id) => !assignedSubjectIds.has(id));

  if (assignedSubjectIds.size === 0) {
    status = "Pending";
  } else if (orphanEvaluations) {
    status = "Needs Review";
  } else {
    const allEvaluated = [...assignedSubjectIds].every((id) => evaluatedSubjectIds.has(id));
    status = allEvaluated ? "Evaluated" : "Pending";
  }

  await db.collection("students").doc(studentId).update({ status, updatedAt: serverTimestamp() });
  return status;
}
