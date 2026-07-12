/**
 * Injects the shared sidebar/topbar for Admin and Student pages so the nav
 * markup only lives in one place. Call renderAdminLayout(active, profile) or
 * renderStudentLayout(active, profile) after requireRole() resolves.
 */

const ADMIN_NAV = [
  { key: "dashboard", label: "Dashboard", href: "admin-dashboard.html", icon: "bi-speedometer2" },
  { key: "students", label: "Students", href: "admin-students.html", icon: "bi-people" },
  { key: "subjects", label: "Subjects", href: "admin-subjects.html", icon: "bi-journal-bookmark" },
  { key: "assignments", label: "Subject Assignment", href: "admin-assignments.html", icon: "bi-diagram-3" },
  { key: "evaluations", label: "Evaluations", href: "admin-evaluations.html", icon: "bi-clipboard-check" },
  { key: "reports", label: "Reports", href: "admin-reports.html", icon: "bi-file-earmark-bar-graph" }
];

const STUDENT_NAV = [
  { key: "dashboard", label: "Dashboard", href: "student-dashboard.html", icon: "bi-speedometer2" },
  { key: "subjects", label: "My Subjects", href: "student-subjects.html", icon: "bi-journal-bookmark" },
  { key: "evaluations", label: "My Evaluation Results", href: "student-evaluations.html", icon: "bi-clipboard-check" }
];

function buildSidebar(navItems, active, title) {
  const items = navItems
    .map(
      (n) => `
      <li class="nav-item">
        <a class="nav-link ${n.key === active ? "active" : ""}" href="${n.href}">
          <i class="bi ${n.icon} me-2"></i>${n.label}
        </a>
      </li>`
    )
    .join("");
  return `
    <div class="sidebar-brand">
      <img src="../../image/Logo%20transparent.png" alt="Nexus Integrative University logo" class="sidebar-logo" />
      <div class="sidebar-brand-text">
        <strong>Nexus Integrative University</strong>
        <span>${title}</span>
      </div>
    </div>
    <ul class="nav flex-column">${items}</ul>
    <div class="sidebar-footer">
      <button class="btn btn-outline-light btn-sm w-100" id="logout-btn">
        <i class="bi bi-box-arrow-right me-1"></i>Logout
      </button>
    </div>`;
}

function renderLayout(navItems, active, title, profile, redirectOnLogout) {
  const app = document.getElementById("app-root");
  const sidebarHtml = buildSidebar(navItems, active, title);
  const wrapper = document.createElement("div");
  wrapper.className = "app-shell";
  wrapper.innerHTML = `
    <nav class="sidebar" id="sidebar">${sidebarHtml}</nav>
    <div class="main-area">
      <header class="topbar d-flex align-items-center justify-content-between">
        <button class="btn btn-sm btn-light d-lg-none" id="sidebar-toggle"><i class="bi bi-list"></i></button>
        <h5 class="mb-0 page-title"></h5>
        <div class="d-flex align-items-center gap-2">
          <span class="text-muted small d-none d-sm-inline">${escapeHtml(profile.fullName || profile.email)}</span>
          <span class="badge bg-primary text-uppercase">${profile.role}</span>
        </div>
      </header>
      <main class="content-area" id="content-area"></main>
    </div>`;
  app.prepend(wrapper);

  document.getElementById("logout-btn").addEventListener("click", () => logout(redirectOnLogout));
  const toggle = document.getElementById("sidebar-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => document.getElementById("sidebar").classList.toggle("show"));
  }

  const titleEl = wrapper.querySelector(".page-title");
  const activeItem = navItems.find((n) => n.key === active);
  if (titleEl && activeItem) titleEl.textContent = activeItem.label;

  return document.getElementById("content-area");
}

function renderAdminLayout(active, profile) {
  return renderLayout(ADMIN_NAV, active, "Admin Portal", profile, "../../admin-login.html");
}

function renderStudentLayout(active, profile) {
  return renderLayout(STUDENT_NAV, active, "Student Portal", profile, "../../index.html");
}
