// Shared Credit Evaluation view, used by BOTH the Admin Evaluations page
// (interactive: Mark credited / remove) and the Student read-only page.
// Requires utils.js first (YEAR_ORDER, getRequiredSubjects, buildCreditedMap,
// getNotCreditedReason, escapeHtml, escapeOrDash, statusBadge).
//
// On the admin page these globals must also exist: openCreditModal(creditId,
// preselectSubjectId) and deleteCreditedSubject(creditId, studentId).

const SEM_ORDER = ["1st Semester", "2nd Semester", "Midterm", "Summer"];

// Module-level state so the filter dropdown can re-render on its own.
let _evalState = null;

// Build the data model once from raw docs.
function buildEvalModel(student, allSubjects, creditedDocs) {
  const required = getRequiredSubjects(student, allSubjects);
  const requiredById = Object.fromEntries(required.map((s) => [s.id, s]));
  const creditedMap = buildCreditedMap(creditedDocs);
  return { required, requiredById, creditedMap };
}

// Entry point. container: element to render into.
function renderCreditEvaluation(container, opts) {
  const student = opts.student;
  const model = opts.model;
  const defaultFilter = YEAR_ORDER.includes(student.yearLevel) ? student.yearLevel : "ALL";
  _evalState = {
    container,
    student,
    required: model.required,
    requiredById: model.requiredById,
    creditedMap: model.creditedMap,
    interactive: !!opts.interactive,
    filter: defaultFilter
  };
  _renderEvalShell();
}

function _evalFilterOptions() {
  const opts = [{ key: "ALL", label: "All years" }];
  const years = YEAR_ORDER.filter((y) => _evalState.required.some((s) => s.yearLevel === y));
  years.forEach((y) => {
    opts.push({ key: y, label: y });
    SEM_ORDER.filter((sem) => _evalState.required.some((s) => s.yearLevel === y && s.semester === sem)).forEach((sem) =>
      opts.push({ key: y + "||" + sem, label: "↳ " + y + " - " + sem })
    );
  });
  return opts;
}

function _matchesFilter(s) {
  const f = _evalState.filter;
  if (f === "ALL") return true;
  if (f.indexOf("||") > -1) {
    const parts = f.split("||");
    return s.yearLevel === parts[0] && s.semester === parts[1];
  }
  return s.yearLevel === f;
}

function _renderEvalShell() {
  const st = _evalState;
  const total = st.required.length;
  const creditedCount = st.required.filter((s) => st.creditedMap.has(s.id)).length;
  const remaining = total - creditedCount;
  const pct = total ? Math.round((creditedCount / total) * 100) : 0;
  const who = st.interactive ? "this student's" : "your";

  if (total === 0) {
    st.container.innerHTML =
      _headerHtml() +
      `<div class="alert alert-warning mb-0">No catalog subjects found yet for ${who} <strong>${escapeOrDash(
        st.student.curriculum
      )} curriculum</strong> / <strong>${escapeOrDash(st.student.track)} track</strong>.</div>`;
    return;
  }

  const opts = _evalFilterOptions();
  const filterSelect =
    `<select class="form-select form-select-sm" id="eval-filter" style="max-width:260px">` +
    opts.map((o) => `<option value="${escapeHtml(o.key)}"${o.key === st.filter ? " selected" : ""}>${escapeHtml(o.label)}</option>`).join("") +
    `</select>`;

  st.container.innerHTML = `
    ${_headerHtml()}

    <div class="row row-cols-3 g-2 mb-3">
      <div class="col">
        <div class="border rounded p-2 text-center h-100">
          <div class="fs-4 fw-bold">${total}</div>
          <div class="small text-muted">Required subjects</div>
        </div>
      </div>
      <div class="col">
        <div class="border rounded p-2 text-center h-100" style="background:#eafaf1">
          <div class="fs-4 fw-bold text-success">${creditedCount}</div>
          <div class="small text-muted">Already credited</div>
        </div>
      </div>
      <div class="col">
        <div class="border rounded p-2 text-center h-100" style="background:#fff8ec">
          <div class="fs-4 fw-bold text-warning-emphasis">${remaining}</div>
          <div class="small text-muted">Still to take</div>
        </div>
      </div>
    </div>

    <div class="credit-progress mb-3">
      <div class="d-flex justify-content-between align-items-end mb-1">
        <span class="fw-semibold">Credit progress</span>
        <span class="small text-muted">${pct}% complete</span>
      </div>
      <div class="progress" style="height:12px;border-radius:8px;">
        <div class="progress-bar" role="progressbar" style="width:${pct}%;" aria-valuenow="${pct}">${pct}%</div>
      </div>
    </div>

    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div class="eval-legend small text-muted">
        <span class="legend-dot bg-success"></span>Credited &mdash; already taken
        <span class="legend-dot legend-open ms-3"></span>To take &mdash; not yet credited
        <span class="legend-dot bg-warning ms-3"></span>Needs prerequisite first
      </div>
      <div class="d-flex align-items-center gap-2">
        ${
          st.interactive && remaining > 0
            ? `<button type="button" class="btn btn-sm btn-outline-success" onclick="markAllCredited()">
                 <i class="bi bi-check2-all me-1"></i>Mark All Credited (${remaining})
               </button>`
            : ""
        }
        <label class="small text-muted mb-0">View</label>
        ${filterSelect}
      </div>
    </div>

    <div id="eval-groups">${_renderGroups()}</div>`;

  const sel = document.getElementById("eval-filter");
  if (sel)
    sel.addEventListener("change", (e) => {
      _evalState.filter = e.target.value;
      document.getElementById("eval-groups").innerHTML = _renderGroups();
    });
}

function _headerHtml() {
  const st = _evalState;
  const meta = [st.student.curriculum, st.student.track, st.student.yearLevel, st.student.studentType]
    .filter(Boolean)
    .map((x) => escapeHtml(x))
    .join(" &middot; ");
  return `
    <div class="d-flex justify-content-between align-items-start mb-3 flex-wrap gap-2">
      <div>
        <h5 class="mb-1">${escapeHtml(st.student.fullName || st.student.email || "Student")}</h5>
        <div class="text-muted small">${meta || "&mdash;"}</div>
      </div>
      ${statusBadge(st.student.status || "Pending")}
    </div>`;
}

function _renderGroups() {
  const st = _evalState;
  const visible = st.required.filter(_matchesFilter);
  if (!visible.length) return `<div class="text-muted text-center py-4">Nothing to show for this filter.</div>`;

  const cur = st.student.yearLevel;
  const years = YEAR_ORDER.filter((y) => visible.some((s) => s.yearLevel === y)).sort((a, b) => {
    if (a === cur) return -1;
    if (b === cur) return 1;
    return YEAR_ORDER.indexOf(a) - YEAR_ORDER.indexOf(b);
  });

  return years
    .map((year) => {
      const yearSubs = visible.filter((s) => s.yearLevel === year);
      const yCred = yearSubs.filter((s) => st.creditedMap.has(s.id)).length;
      const semBlocks = SEM_ORDER.filter((sem) => yearSubs.some((s) => s.semester === sem))
        .map((sem) => {
          const rows = yearSubs
            .filter((s) => s.semester === sem)
            .sort((a, b) => (a.subjectCode || "").localeCompare(b.subjectCode || ""));
          const done = rows.filter((s) => st.creditedMap.has(s.id)).length;
          return `
        <div class="sem-group">
          <div class="sem-head">${escapeHtml(sem)}<span class="sem-count">${done}/${rows.length}</span></div>
          <div class="subj-list">${rows.map((s) => _renderSubjectRow(s)).join("")}</div>
        </div>`;
        })
        .join("");
      return `
      <div class="year-block${year === cur ? " current" : ""}">
        <div class="year-head">
          <span class="year-title">${escapeHtml(year)}${year === cur ? ` <span class="badge current-pill">Current</span>` : ""}</span>
          <span class="year-count">${yCred}/${yearSubs.length} credited</span>
        </div>
        ${semBlocks}
      </div>`;
    })
    .join("");
}

function _renderSubjectRow(s) {
  const st = _evalState;
  const credited = st.creditedMap.has(s.id);
  let pill;
  let actions = "";

  if (credited) {
    pill = `<span class="badge rounded-pill bg-success">Credited</span>`;
    if (st.interactive) {
      const rec = st.creditedMap.get(s.id);
      actions = `<button class="btn btn-sm btn-outline-danger border-0" title="Remove credit" onclick="deleteCreditedSubject('${rec.id}','${st.student.id}')"><i class="bi bi-x-lg"></i></button>`;
    }
  } else {
    const reason = getNotCreditedReason(s, st.creditedMap, st.requiredById);
    const isPrereq = reason.indexOf("Requires prerequisite") === 0;
    pill = isPrereq
      ? `<span class="badge rounded-pill bg-warning text-dark" title="${escapeHtml(reason)}">Prereq needed</span>`
      : `<span class="badge rounded-pill open-pill">To take</span>`;
    if (st.interactive) {
      actions = `<button class="btn btn-sm btn-outline-primary" onclick="openCreditModal(null,'${s.id}')" data-bs-toggle="modal" data-bs-target="#creditModal">Mark credited</button>`;
    }
  }

  return `
    <div class="subj-row${credited ? " is-credited" : ""}">
      <div class="subj-main">
        <span class="subj-code">${escapeHtml(s.subjectCode)}</span>
        <span class="subj-name">${escapeHtml(s.subjectName)}</span>
      </div>
      <div class="subj-meta">
        ${pill}
        ${actions}
      </div>
    </div>`;
}
