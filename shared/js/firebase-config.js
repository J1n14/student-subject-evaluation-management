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

// Offline support (optional) - safe to ignore failures (e.g. multiple tabs open)
db.enablePersistence().catch((err) => {
  console.warn("Firestore offline persistence not enabled:", err.code);
});

// Session persistence - stay logged in across browser restarts
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const FieldValue = firebase.firestore.FieldValue;
const serverTimestamp = () => FieldValue.serverTimestamp();
