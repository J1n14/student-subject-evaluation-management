/**
 * One-time script: creates the first Admin account end-to-end.
 * Creates the Firebase Auth user, then writes the matching users/{uid}
 * Firestore document with role: 'admin'.
 *
 * Requires serviceAccountKey.json (Project settings > Service accounts >
 * Generate new private key) in this same folder.
 *
 * Usage:
 *   node create-admin.js <email> <password> "<Full Name>"
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

const [, , email, password, fullName] = process.argv;

if (!email || !password || !fullName) {
  console.error('Usage: node create-admin.js <email> <password> "<Full Name>"');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
});

async function main() {
  const auth = getAuth();
  const db = getFirestore();

  let userRecord;
  try {
    userRecord = await auth.createUser({ email, password, displayName: fullName });
    console.log(`Created Auth user: ${userRecord.uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      userRecord = await auth.getUserByEmail(email);
      console.log(`Auth user already existed: ${userRecord.uid}`);
    } else {
      throw err;
    }
  }

  const now = FieldValue.serverTimestamp();
  await db.collection("users").doc(userRecord.uid).set(
    {
      role: "admin",
      email,
      fullName,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true }
  );

  console.log(`users/${userRecord.uid} written with role: admin`);
  console.log("Done. You can now log in at admin-login.html.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to create admin:", err);
  process.exit(1);
});
