/**
 * Firebase configuration and SDK initialization.
 *
 * Replace the placeholder values below with the config object from
 * Firebase Console > Project Settings > General > Your apps > SDK setup and configuration.
 * See README.md for full setup instructions.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBDTo5frtaS1YkbjforWs4tE-sYN2dn1F8",
  authDomain: "student-subject-eval.firebaseapp.com",
  projectId: "student-subject-eval",
  storageBucket: "student-subject-eval.firebasestorage.app",
  messagingSenderId: "20263869625",
  appId: "1:20263869625:web:63ed9ab0168fae9a850f68"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage ? firebase.storage() : null;

// When served from localhost (e.g. `firebase emulators:start`), talk to the
// local Firestore/Auth emulators instead of production - never touches real
// student data during development. Must run before any other db/auth calls,
// which is why this sits immediately after they're created. See
// firebase/seed-emulator.js for seeding the local database.
if (["localhost", "127.0.0.1"].includes(location.hostname)) {
  db.useEmulator("127.0.0.1", 8080);
  auth.useEmulator("http://127.0.0.1:9099", { disableWarnings: true });
  console.info("[dev] Connected to local Firebase emulators (Firestore :8080, Auth :9099).");
}

// NOTE: Firestore offline persistence (db.enablePersistence()) is
// intentionally NOT enabled. It writes to IndexedDB, which on some browsers
// contends with Firebase Auth's own IndexedDB-based session storage during a
// fast full-page redirect (login -> dashboard). That race is what caused the
// "have to log in twice / bounced back to the login page" bug. Since offline
// support was optional for this app, the safest fix is to leave it off.

// Session persistence - stay logged in across browser restarts.
// Exposed as a promise so auth.js can await it before signing in, closing
// out any remaining race between persistence setup and sign-in.
const authPersistenceReady = auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const FieldValue = firebase.firestore.FieldValue;
const serverTimestamp = () => FieldValue.serverTimestamp();
