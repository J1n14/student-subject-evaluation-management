/**
 * One-time script: renames the legacy "All Tracks" subject.track value to
 * "General" on every subject already saved in Firestore. Safe to re-run
 * (only touches docs still tagged "All Tracks").
 *
 * The app code already treats "All Tracks" and "General" as equivalent when
 * matching a student's required subjects, so running this is optional for
 * correctness - it just cleans up the stored label so it matches the UI.
 *
 * Requires serviceAccountKey.json (Project settings > Service accounts >
 * Generate new private key) in this same folder.
 *
 * Usage:
 *   node migrate-track-label.js
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({
  credential: cert(serviceAccount),
});

async function main() {
  const db = getFirestore();
  const snap = await db.collection("subjects").where("track", "==", "All Tracks").get();

  if (snap.empty) {
    console.log('No subjects found with track "All Tracks". Nothing to do.');
    process.exit(0);
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, { track: "General", updatedAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();

  console.log(`Updated ${snap.size} subject(s): track "All Tracks" -> "General".`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
