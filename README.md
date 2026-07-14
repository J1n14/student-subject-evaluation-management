# Student Subject Evaluation Management System (Firebase)

A static HTML/CSS/JS + Bootstrap 5 app backed by Firebase (Authentication +
Cloud Firestore, with optional Storage/Hosting). No build step, no server —
open the HTML files directly or deploy with Firebase Hosting.

## 1. File overview

Files are organized by portal, with each portal split into `html/` and `js/`,
plus a `shared/` folder for code used by both. No build step - the app can
be opened or hosted as-is.

```
index.html            Home page - choose Admin Portal or Student Portal
admin-login.html      Admin login (linked from index.html)
student-login.html    Student login (linked from index.html; students never
                       self-register, see section 4)
admin/
  html/                admin-dashboard, admin-students, admin-subjects,
                       admin-assignments, admin-evaluations, admin-reports
  js/                  matching .js for each page above
student/
  html/                student-dashboard, student-subjects, student-evaluations
  js/                  matching .js for each page above
shared/
  js/                  firebase-config.js, auth.js, layout.js, utils.js
  css/                 style.css
firebase/
  firestore.rules, firestore.indexes.json   Firestore security rules + composite indexes
  storage.rules        Optional Storage rules for profile pictures
  create-admin.js      One-time script: creates the first Admin account
  seed-old-curriculum.js  One-time script: bulk-seeds the Old-curriculum
                       subject catalog (run again after editing its list)
  seed-new-curriculum.js  One-time script: bulk-seeds the New-curriculum
                       subject catalog, reusing/updating any matching
                       legacy (untagged) subjects and deleting the rest
  migrate-track-label.js  One-time script: renames the legacy "All Tracks"
                       subject.track value to "General" on already-saved
                       data (optional - the app matches both values anyway)
  serviceAccountKey.json   Admin SDK credential (gitignored, not committed)
firebase.json          Hosting/deploy config (stays at project root - required
                       by the Firebase CLI)
package.json           Node deps for firebase/create-admin.js (firebase-admin)
```

| File | Purpose |
|---|---|
| `shared/js/firebase-config.js` | Firebase SDK init — **edit this with your project keys** |
| `shared/js/auth.js` | Login / route guards |
| `shared/js/layout.js` | Shared sidebar/topbar for both portals |
| `shared/js/utils.js` | Toasts, formatting, pagination, activity logs, and the shared Credit Evaluation computation helpers (`getRequiredSubjects`, `computeCreditProgress`, `getNotCreditedReason`, `recomputeCreditStatus`, etc.) used by both portals |
| `shared/css/style.css` | All styling, including print styles for Reports |
| `admin/html/admin-dashboard.html` / `admin/js/admin-dashboard.js` | Admin dashboard: summary cards, recent credited subjects, credit status chart |
| `admin/html/admin-students.html` / `admin/js/admin-students.js` | Student CRUD, search, filter, pagination |
| `admin/html/admin-subjects.html` / `admin/js/admin-subjects.js` | Subject CRUD (including Curriculum and Prerequisite) |
| `admin/html/admin-assignments.html` / `admin/js/admin-assignments.js` | Assign/remove subjects per student, with a running unit total, an admin-editable min/max Unit Load Policy, and overload/underload confirmation prompts |
| `admin/html/admin-evaluations.html` / `admin/js/admin-evaluations.js` | Credit Evaluation: progress ring/bars, Credited Subjects (manual transcript credits), Subjects Still To Take against curriculum requirements |
| `admin/html/admin-reports.html` / `admin/js/admin-reports.js` | Printable reports (summary / assignments / credited subjects) |
| `student/html/student-dashboard.html` / `student/js/student-dashboard.js` | Student welcome + status overview |
| `student/html/student-subjects.html` / `student/js/student-subjects.js` | Read-only assigned subjects (real-time) |
| `student/html/student-evaluations.html` / `student/js/student-evaluations.js` | Read-only mirror of the student's own Credit Evaluation (progress, credited subjects, still to take) |

## 2. Firebase project setup

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database** → **Create database** (start in production mode).
4. **Project settings → General → Your apps → Add app → Web (`</>`)** → copy the config object.
5. Open `shared/js/firebase-config.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

6. Deploy the security rules (requires the [Firebase CLI](https://firebase.google.com/docs/cli)):

```bash
npm install -g firebase-tools
firebase login
firebase init   # select this folder, choose existing project
firebase deploy --only firestore:rules,firestore:indexes,storage
```

   (Or paste the contents of `firebase/firestore.rules` / `firebase/storage.rules`
   directly into Console → Firestore → Rules / Storage → Rules.)

## 3. Bootstrapping your first Admin account

Because Admins have full data access, the client app deliberately **cannot**
self-register an Admin (only `role: 'student'` accounts can be created from
the browser — see `firebase/firestore.rules`). Use the one-time
`firebase/create-admin.js` script instead:

1. Firebase Console → gear icon → **Project settings → Service accounts** →
   **Generate new private key** → save the downloaded file as
   `firebase/serviceAccountKey.json` (already gitignored - never commit it).
2. `npm install` (installs `firebase-admin`, used only by this script).
3. Run it:
   ```bash
   node firebase/create-admin.js admin@example.com "SomePassword123" "Your Name"
   ```
   This creates the Firebase Auth user and writes `users/{uid}` with
   `role: 'admin'` in one step.
4. Open `admin-login.html` and sign in.

Any further Admin accounts can be created the same way, or you can extend
`admin/js/admin-students.js` with an "Add Admin" flow later.

## 4. How students get accounts

Students never self-register. An Admin creates the full account in one step
via **Admin → Students → Add Student** (First/Last Name, Email, Source
College, Course, Curriculum, Track, Year Level, Student Type, Academic Year):

1. There is no student record code / ID for the admin to assign or type -
   students are just enrolled. The `students` doc key is a plain
   Firestore-generated ID under the hood, never shown or referenced in the UI.
2. The client creates the Firebase Auth account immediately - **email** as
   entered, and **password = the student's Last Name** (padded with zeros to
   6 characters if their last name is shorter, since Firebase requires a
   6-character minimum password). The exact password used is shown in the
   confirmation toast after saving so you can pass it on to the student.
3. It then writes the `students/{autoId}` document (including the new `uid`)
   and `users/{uid}` with `role: 'student'`.
4. The student logs in at `student-login.html` using their email and their
   Last Name as the password.

Student Type is one of **Regular, Irregular, Returnee, Transferee, Failed**.
Regular still auto-credits every lower-year subject in the student's plan
(unchanged behavior). Returnee, Transferee, and Failed reveal a **Last School
Year Attended** field; Transferee additionally reveals **Previous School**.

This uses a throwaway secondary Firebase App instance under the hood
(`createStudentAuthAccount()` in `admin-students.js`) so creating the
student's login doesn't sign the Admin out of their own session - the
Firebase JS SDK otherwise only tracks one signed-in user per browser per app.

Note: a Last Name as a password is predictable/guessable. Consider having
students change it after first login if you add that capability later.

## 5. Running locally

No build step needed. Two options:

- **Quickest:** open `index.html` directly in a browser - it's the home page.
  (Firebase Auth
  works fine from `file://`, though some browsers restrict persistence —
  serving over HTTP is more reliable.)
- **Recommended:** serve the folder locally, e.g.:
  ```bash
  npx serve .
  # or
  python3 -m http.server 8080
  ```

## 6. Deploying (optional)

```bash
firebase deploy --only hosting
```

Your app will be live at `https://YOUR_PROJECT_ID.web.app`.

## 7. Data model

```
users/{uid}            { role, email, fullName, studentId, createdAt, updatedAt }
students/{autoId}      { firstName, lastName, fullName, email, college, course, curriculum, track,
                          yearLevel, studentType, academicYear, lastSchoolYearAttended, previousSchool,
                          status, uid, createdAt, updatedAt }
subjects/{subjectId}   { subjectCode, subjectName, units, yearLevel, semester, academicYear, track, curriculum, prerequisite, status, createdAt, updatedAt }
studentSubjects/{id}   { studentId, subjectId, assignedAt, overload }
creditedSubjects/{studentId_subjectId}  { studentId, subjectId, creditedFrom, grade, remarks, creditedBy, creditedAt }
activityLogs/{id}      { userId, email, action, timestamp }
settings/unitPolicy    { minUnits, maxUnits, updatedAt, updatedBy }
```

Notes:
- `students/{autoId}` doc IDs are plain Firestore-generated IDs - there is no
  human-facing student record code. The app never displays or searches by
  this ID; students and admins alike identify a record by name/email.
- `students.studentType` is one of `Regular`, `Irregular`, `Returnee`,
  `Transferee`, `Failed`. Only `Regular` triggers `autoCreditLowerYears()`.
  `lastSchoolYearAttended` is set for Returnee/Transferee/Failed;
  `previousSchool` is set only for Transferee.
- `studentSubjects.overload` is `true` if the assignment was saved while its
  total units exceeded `settings/unitPolicy.maxUnits` and the admin confirmed
  the overload prompt. Purely informational (for reporting), doesn't block
  anything on its own.
- `settings/unitPolicy` holds the admin-editable min/max unit load used by
  the overload/underload confirmation on **Admin → Subject Assignment**.
  Defaults to 15-24 units until an admin saves their own values there.
- `creditedSubjects` documents use a deterministic ID (`studentId_subjectId`)
  and are written with `{ merge: true }`, so re-saving **updates** the
  existing record instead of creating a duplicate. The **Mark All Credited**
  button on **Admin → Evaluations** batch-writes one of these per remaining
  required subject in a single confirm step.
- There is no Pass/Fail/Incomplete grading concept in this system — a
  subject only counts as complete for a student once an admin manually
  records it in `creditedSubjects` (Admin → Evaluations → Credit
  Evaluation), based on the student's transcript or in-house record.
- `students/{id}.status` is recalculated automatically after every
  Credit Evaluation change (`recomputeCreditStatus()` in `shared/js/utils.js`):
  - **Graduated** — every subject required by the student's curriculum/track
    plan has been credited.
  - **In Progress** — at least one required subject is credited, but not all.
  - **Pending** — no required subjects are defined yet for this student's
    curriculum/track, or none have been credited yet.
- `subjects.curriculum` (`"Old"`/`"New"`) mirrors `students.curriculum`;
  subjects without this field set (all subjects created before this feature)
  are treated as `"New"` curriculum when matching against a student's plan.
- `subjects.track` similarly falls back to matching every track if unset. The
  value for "applies to every track" is `"General"` (renamed from the
  original `"All Tracks"` label - both values still match everywhere; run
  `firebase/migrate-track-label.js` once to relabel existing data if you
  want the stored value to read "General" too).
- `subjects.prerequisite` is an optional free-text `subjectCode` (or
  comma-separated list of codes) checked by the Credit Evaluation view to
  explain why a subject can't yet be credited.
- `firebase/seed-old-curriculum.js` bulk-seeds the Old-curriculum BSIT
  subject catalog (all three tracks: Network Technology, Business Analytics,
  Service Management) using deterministic `old_<Code>` doc IDs, so re-running
  it after editing the list only updates existing rows.
- `firebase/seed-new-curriculum.js` does the same for the New curriculum
  (Golden Country Homes / Alangilan campus - this curriculum has no track
  split, every subject is tagged `track: "All Tracks"`). The app's original
  57 untagged demo subjects turned out to be this exact curriculum; any
  whose code matches a course here is updated in place (preserving its doc
  ID, so existing assignments/credits stay valid) rather than duplicated.
  Re-running this script is safe even after a bad previous seed - anything
  tagged `curriculum: "New"` that doesn't belong here gets deleted along
  with its assignments/credited-subject records.

## 8. Security model summary

- Admins (`users/{uid}.role == 'admin'`) have full read/write access to
  everything.
- Students can only read their **own** `students`, `studentSubjects`, and
  `creditedSubjects` documents (matched via `users/{uid}.studentId`), and can
  never write to subjects, assignments, or credited subjects.
- `activityLogs` can be written by any signed-in user for themselves, but
  only read by Admins (used for the "Recent Student Logins" dashboard card).
- `settings` (currently just `settings/unitPolicy`) is Admin-only for both
  read and write.
- Full details in `firebase/firestore.rules`.

## 9. Fixed: had to log in twice / bounced back to the login page

Firestore offline persistence (`db.enablePersistence()`) was removed from
`shared/js/firebase-config.js`. It writes to IndexedDB, which on some
browsers contends with Firebase Auth's own IndexedDB-based session storage
during a fast full-page redirect (login page → dashboard page). That race
was what caused the double-login symptom. `shared/js/auth.js`'s
`requireRole()` also now gives the Auth SDK a short grace window before
concluding no one is logged in, as a second layer of protection against the
same class of race. Offline support was optional for this app, so removing
it is a low-cost fix.

## 10. UI/UX pass (login, students, assignment, evaluation)

- **Login pages** — both `admin-login.html` and `student-login.html` have a
  show/hide (eye icon) password toggle, a **Forgot password?** link
  (`handleForgotPassword()` in `shared/js/utils.js`, sends a Firebase Auth
  reset email), and an example email placeholder.
- **Dashboard** — the "Total Credited Subjects" card was removed from
  `admin/js/admin-dashboard.js`; the recent-activity table column reads
  **Course Code** instead of Subject.
- **Students / Subjects tables** — the Actions column is now sticky
  (`.sticky-col-end` in `shared/css/style.css`) so Edit/Delete stay visible
  while scrolling horizontally, and the Edit button is a solid, labeled
  button instead of a small icon at the far edge.
- **Add Student form** (`admin/js/admin-students.js`) — **Student Type is
  now the first field**, above Name/Email/etc. Selecting a type shows a
  short note about what it means for that student's subject assignment
  (e.g. Regular auto-credits lower years and only needs the current year
  assigned; Irregular/Returnee/Transferee/Failed need no auto-crediting and
  should be assigned individually on the Assign Subjects page, watching for
  prerequisites).
- **Assign Subjects page** (`admin/js/admin-assignments.js`) was rebuilt:
  a full-width **Select Student** search bar sits at the top (replacing the
  old sidebar list), and the subject picker is now a grouped box/card grid
  (`.subj-box-grid` in `shared/css/style.css`) instead of a table, with
  clear color-coded states — available, assigned, credited, needs
  prerequisite, off-plan. The Unit Load Policy is no longer a standalone
  settings card at the top of the page — it's a small inline "Policy: X–Y
  units [Edit]" control next to the running **Selected units** total inside
  each student's assignment panel, so the limit is visible exactly where an
  admin needs it (while checking subjects) instead of taking up permanent
  top-of-page space. Overload/underload confirmation, Assign-All, and
  Unselect-All logic is unchanged.
- **Students / Subjects tables** — row action buttons (View/Edit/Delete) are
  wrapped in a `d-flex flex-nowrap` group so they stay on one line instead
  of stacking vertically in the sticky Actions column.
- **Evaluation page** — removed the redundant unit count next to each
  subject's Credited/To take pill, and removed the explanatory info banner
  (kept the summary counters and progress bar). The Select Student panel is
  now a top search bar + selected-student chip (same pattern as Subject
  Assignment) instead of a sidebar list that loaded every student up front.

## 11. Second UI pass (tables over boxes, form sections)

- **Subject picker** (`admin/js/admin-assignments.js`) — reverted from the
  box/card grid back to a table, grouped by Year → Semester like before,
  with color-coded rows (left border + tint) for available / assigned /
  credited / needs-prerequisite / off-plan. Clicking anywhere on a row still
  toggles its checkbox. The **Currently Assigned** list is now a table
  (Code, Name, Year, Semester, Units, Status, Remove) instead of pill
  badges, for the same reason - clearer at a glance.
- **Add Student form** — widened to `modal-lg` and split into labeled
  sections (Student Type first, then Personal Information, Academic
  Background, Enrollment Details, Status) so the fields read as a clear
  top-to-bottom flow instead of a dense block of paired inputs.
- **Evaluation page** (`shared/js/credit-eval-view.js`,
  `admin/js/admin-evaluations.js`) now leads with an explanatory line
  ("this is not a grade, it only tracks completion") and three summary
  counters (Required / Credited / Still to take) above the progress bar,
  and the year/semester filter dropdown shows semester options with a
  visible `↳` indent instead of relying on collapsed whitespace.
