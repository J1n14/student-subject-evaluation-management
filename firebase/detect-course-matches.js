/**
 * One-time (rerunnable) script: compares Old-curriculum and New-curriculum
 * subjects. For every pair that shares a subjectCode:
 *   - identical subjectName -> no action needed, already an automatic match.
 *   - different subjectName -> writes a courseMatchExceptions doc so an
 *     Admin can review it on the Course Matches page and Accept/Reject.
 *
 * Safe to re-run: uses a deterministic doc ID (`${oldSubjectId}_${newSubjectId}`)
 * with { merge: true }, so re-running only refreshes existing pending
 * exceptions instead of duplicating them. Does NOT touch exceptions an
 * admin has already reviewed (status "accepted"/"rejected") unless the
 * underlying subjectName changed again, in which case it's reset to
 * "pending" so it gets looked at again.
 *
 * Requires serviceAccountKey.json (same as create-admin.js).
 *
 * Usage:
 *   node detect-course-matches.js
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

async function main() {
  const [subjectsSnap, existingExceptionsSnap] = await Promise.all([
    db.collection("subjects").get(),
    db.collection("courseMatchExceptions").get()
  ]);
  const allDocs = subjectsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const existingById = new Map(existingExceptionsSnap.docs.map((d) => [d.id, d.data()]));

  const groupsByCode = new Map();
  allDocs.forEach((s) => {
    const code = String(s.subjectCode || "").trim().toUpperCase();
    if (!code) return;
    if (!groupsByCode.has(code)) groupsByCode.set(code, []);
    groupsByCode.get(code).push(s);
  });

  const batch = db.batch();
  let newlyFlagged = 0;
  let reopened = 0;
  let skippedIdentical = 0;
  let unchanged = 0;

  for (const subjects of groupsByCode.values()) {
    if (subjects.length <= 1) continue;
    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) {
        const oldSub = subjects[i];
        const newSub = subjects[j];
        if (oldSub.subjectName === newSub.subjectName) {
          skippedIdentical++;
          continue; // identical code + name = automatic match, nothing to flag
        }

        const exceptionId = `${oldSub.id}_${newSub.id}`;
        const existing = existingById.get(exceptionId);
        const ref = db.collection("courseMatchExceptions").doc(exceptionId);
        const baseData = {
          oldSubjectId: oldSub.id,
          newSubjectId: newSub.id,
          oldCode: oldSub.subjectCode,
          oldName: oldSub.subjectName,
          newCode: newSub.subjectCode,
          newName: newSub.subjectName
        };

      if (!existing) {
        // First time seeing this pair.
        batch.set(ref, { ...baseData, status: "pending", detectedAt: FieldValue.serverTimestamp() });
        newlyFlagged++;
      } else if (existing.oldName !== oldSub.subjectName || existing.newName !== newSub.subjectName) {
        // A reviewed pair's names changed since the decision was made -
        // reopen it so the admin re-reviews with fresh data.
        batch.set(ref, { ...baseData, status: "pending", detectedAt: FieldValue.serverTimestamp() }, { merge: true });
        reopened++;
      } else {
        unchanged++; // leave status (pending/accepted/rejected) untouched
      }
    }
  }

  await batch.commit();
  console.log(
    `${newlyFlagged} new mismatch(es) flagged, ${reopened} reopened due to name changes, ` +
    `${unchanged} unchanged (left as-is), ${skippedIdentical} already matched automatically.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
