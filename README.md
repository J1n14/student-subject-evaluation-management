# Student Subject Evaluation Management System (Firebase)

A static HTML/CSS/JS + Bootstrap 5 app backed by Firebase (Authentication +
Cloud Firestore, with optional Storage/Hosting). No build step, no server —
open the HTML files directly or deploy with Firebase Hosting.

## 1. File overview

All files are flat in this folder (no subfolders) so the app can be opened
or hosted as-is.

| File | Purpose |
|---|---|
| `index.html` | Student login (also the site's landing page) |
| `admin-login.html` | Admin login (not linked from `index.html` - go to it directly) |
| `admin-dashboard.html` / `.js` | Admin dashboard: summary cards, recent activity, chart |
| `admin-students.html` / `.js` | Student CRUD, search, filter, pagination |
| `admin-subjects.html` / `.js` | Subject CRUD |
| `admin-assignments.html` / `.js` | Assign/remove subjects per student |
| `admin-evaluations.html` / `.js` | Per-subject evaluation entry, duplicate-safe |
| `admin-reports.html` / `.js` | Printable reports (summary / assignments / evaluations) |
| `student-dashboard.html` / `.js` | Student welcome + status overview |
| `student-subjects.html` / `.js` | Read-only assigned subjects (real-time) |
| `student-evaluations.html` / `.js` | Read-only evaluation results (real-time) |
| `firebase-config.js` | Firebase SDK init — **edit this with your project keys** |
| `auth.js` | Login / registration / route guards |
| `layout.js` | Shared sidebar/topbar for both portals |
| `utils.js` | Toasts, formatting, pagination, activity logs, auto-status logic |
| `style.css` | All styling, including print styles for Reports |
| `firestore.rules`, `firestore.indexes.json` | Firestore security rules + required composite indexes |
| `storage.rules` | Optional Storage rules for profile pictures |
| `firebase.json` | Hosting/deploy config |

## 2. Firebase project setup

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. **Build → Authentication → Sign-in method** → enable **Email/Password**.
3. **Build → Firestore Database** → **Create database** (start in production mode).
4. **Project settings → General → Your apps → Add app → Web (`</>`)** → copy the config object.
5. Open `firebase-config.js` in this folder and replace the placeholder values:

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

   (Or paste the contents of `firestore.rules` / `storage.rules` directly into
   Console → Firestore → Rules / Storage → Rules.)

## 3. Bootstrapping your first Admin account

Because Admins have full data access, the client app deliberately **cannot**
self-register an Admin (only `role: 'student'` accounts can be created from
the browser — see `firestore.rules`). Create the first Admin manually, once:

1. **Authentication → Users → Add user** — enter your admin email + password.
2. **Firestore Database → Start collection → `users`** → document ID = the
   new user's **UID** (copy it from the Authentication tab) → add fields:
   - `role` (string) = `admin`
   - `email` (string) = same email
   - `fullName` (string) = your name
   - `createdAt`, `updatedAt` (timestamp) = now
3. Open `admin-login.html` and sign in.

Any further Admin accounts can be created the same way, or you can extend
`admin-students.html` with an "Add Admin" flow later.

## 4. How students get accounts

Students never self-register. An Admin creates the full account in one step
via **Admin → Students → Add Student** (Student ID, Full Name, Email, Course,
Year Level):

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
students/{studentId}   { fullName, email, course, yearLevel, status, uid, createdAt, updatedAt }
subjects/{subjectId}   { subjectCode, subjectName, units, semester, academicYear, status, createdAt, updatedAt }
studentSubjects/{id}   { studentId, subjectId, assignedAt }
evaluations/{studentId_subjectId}  { studentId, subjectId, status, remarks, evaluatedBy, evaluatedAt }
activityLogs/{id}      { userId, email, action, timestamp }
```

Notes:
- `evaluations` documents use a deterministic ID (`studentId_subjectId`) and
  are written with `{ merge: true }`, so re-saving an evaluation **updates**
  the existing record instead of creating a duplicate.
- `students/{id}.status` is recalculated automatically after every
  assignment or evaluation change (`recomputeStudentStatus()` in `utils.js`):
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
- Full details in `firestore.rules`.
