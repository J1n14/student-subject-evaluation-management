# Student Subject Evaluation Management System (Firebase)

A static HTML/CSS/JS + Bootstrap 5 app backed by Firebase (Authentication +
Cloud Firestore, with optional Storage/Hosting). No build step, no server —
open the HTML files directly or deploy with Firebase Hosting.

## 1. File overview

Files are organized by portal, with each portal split into `html/` and `js/`,
plus a `shared/` folder for code used by both. No build step - the app can
be opened or hosted as-is.

```
index.html            Student login (also the site's landing page)
admin-login.html       Admin login (not linked from index.html - go to it directly)
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
| `shared/js/utils.js` | Toasts, formatting, pagination, activity logs, auto-status logic |
| `shared/css/style.css` | All styling, including print styles for Reports |
| `admin/html/admin-dashboard.html` / `admin/js/admin-dashboard.js` | Admin dashboard: summary cards, recent activity, chart |
| `admin/html/admin-students.html` / `admin/js/admin-students.js` | Student CRUD, search, filter, pagination |
| `admin/html/admin-subjects.html` / `admin/js/admin-subjects.js` | Subject CRUD |
| `admin/html/admin-assignments.html` / `admin/js/admin-assignments.js` | Assign/remove subjects per student |
| `admin/html/admin-evaluations.html` / `admin/js/admin-evaluations.js` | Per-subject evaluation entry, duplicate-safe |
| `admin/html/admin-reports.html` / `admin/js/admin-reports.js` | Printable reports (summary / assignments / evaluations) |
| `student/html/student-dashboard.html` / `student/js/student-dashboard.js` | Student welcome + status overview |
| `student/html/student-subjects.html` / `student/js/student-subjects.js` | Read-only assigned subjects (real-time) |
| `student/html/student-evaluations.html` / `student/js/student-evaluations.js` | Read-only evaluation results (real-time) |

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
via **Admin → Students → Add Student** (Student ID, Full Name, Email, Source
College, Curriculum, Track, Year Level):

1. The client creates the Firebase Auth account immediately - **email** as
   entered, and **password = the Student ID** (must be at least 6 characters,
   since Firebase requires a 6-character minimum password).
2. It then writes `students/{studentId}` (including the new `uid`) and
   `users/{uid}` with `role: 'student'`.
3. The student logs in at `index.html` using their email and their
   Student ID as the password.

This uses a throwaway secondary Firebase App instance under the hood
(`createStudentAuthAccount()` in `admin-students.js`) so creating the
student's login doesn't sign the Admin out of their own session - the
Firebase JS SDK otherwise only tracks one signed-in user per browser per app.

Note: a Student ID as a password is predictable/guessable. Consider having
students change it after first login if you add that capability later.

## 5. Running locally

No build step needed. Two options:

- **Quickest:** open `index.html` directly in a browser. (Firebase Auth
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
students/{studentId}   { fullName, email, college, curriculum, track, yearLevel, status, uid, createdAt, updatedAt }
subjects/{subjectId}   { subjectCode, subjectName, units, yearLevel, semester, academicYear, status, createdAt, updatedAt }
studentSubjects/{id}   { studentId, subjectId, assignedAt }
evaluations/{studentId_subjectId}  { studentId, subjectId, status, remarks, evaluatedBy, evaluatedAt }
activityLogs/{id}      { userId, email, action, timestamp }
```

Notes:
- `evaluations` documents use a deterministic ID (`studentId_subjectId`) and
  are written with `{ merge: true }`, so re-saving an evaluation **updates**
  the existing record instead of creating a duplicate.
- `students/{id}.status` is recalculated automatically after every
  assignment or evaluation change (`recomputeStudentStatus()` in `shared/js/utils.js`):
  - **Evaluated** — every assigned subject has a saved evaluation.
  - **Pending** — at least one assigned subject has no evaluation yet.
  - **Needs Review** — an evaluation exists for a subject that is no longer
    assigned (data drift), flagged for Admin attention.

## 8. Security model summary

- Admins (`users/{uid}.role == 'admin'`) have full read/write access to
  everything.
- Students can only read their **own** `students`, `studentSubjects`, and
  `evaluations` documents (matched via `users/{uid}.studentId`), and can
  never write to subjects, assignments, or evaluations.
- `activityLogs` can be written by any signed-in user for themselves, but
  only read by Admins (used for the "Recent Student Logins" dashboard card).
- Full details in `firebase/firestore.rules`.
