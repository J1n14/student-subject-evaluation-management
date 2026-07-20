/**
 * Seeds the LOCAL Firebase emulators (Firestore + Auth) with a working
 * local database covering every collection the app reads/writes:
 * subjects, students, users, studentSubjects (assignments), creditedSubjects,
 * settings (unit load policy), courseMatchExceptions, and activityLogs.
 *
 * Subject data is reused from seed-new-curriculum.js / seed-old-curriculum.js
 * (the real catalogs). Safe by construction - never touches production. It
 * only talks to whatever FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST
 * point to (defaulted below to the ports in firebase.json's "emulators"
 * block), and needs no serviceAccountKey.json since the emulators don't
 * check credentials.
 *
 * Usage:
 *   1. In one terminal: firebase emulators:start
 *   2. In another:      npm run seed:emulator
 */
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";

const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

const newCurriculum = require("./seed-new-curriculum.js");
const oldCurriculum = require("./seed-old-curriculum.js");

initializeApp({ projectId: "student-subject-eval" });
const db = getFirestore();
const auth = getAuth();

const ACCOUNTS = {
  admin: { email: "admin@nexus.edu", password: "Admin123!", fullName: "Local Admin" },
  studentNew: { email: "juan.delacruz@nexus.edu", password: "Student123!", fullName: "Juan Dela Cruz" },
  studentOld: { email: "maria.santos@nexus.edu", password: "Student123!", fullName: "Maria Santos" }
};

async function upsertAuthUser({ email, password, fullName }) {
  let user;
  try {
    user = await auth.createUser({ email, password, displayName: fullName });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      user = await auth.getUserByEmail(email);
    } else {
      throw err;
    }
  }
  return user;
}

// Builds the full doc (including its deterministic Firestore ID) for every
// catalog subject, the same shape/ID scheme the production seed scripts use
// - so studentSubjects/creditedSubjects records below can reference real
// subjectIds without a round trip back to Firestore.
function withIds(subjects, prefix, extra) {
  return subjects.map((s) => ({
    ...s,
    ...extra,
    id: `${prefix}_${s.subjectCode.replace(/\s+/g, "")}`
  }));
}

async function seedSubjects(newSubjects, oldSubjects) {
  const batch = db.batch();
  newSubjects.forEach((s) => {
    const { id, ...data } = s;
    batch.set(db.collection("subjects").doc(id), {
      ...data,
      status: "Active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  oldSubjects.forEach((s) => {
    const { id, ...data } = s;
    batch.set(db.collection("subjects").doc(id), {
      ...data,
      status: "Active",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  console.log(`subjects: seeded ${newSubjects.length} New-curriculum + ${oldSubjects.length} Old-curriculum.`);
}

async function seedSettings() {
  await db.collection("settings").doc("unitPolicy").set({
    minUnits: 15,
    maxUnits: 24,
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: ACCOUNTS.admin.email
  });
  console.log("settings: seeded unitPolicy (15-24 units).");
}

async function seedAdmin() {
  const user = await upsertAuthUser(ACCOUNTS.admin);
  await db.collection("users").doc(user.uid).set(
    {
      role: "admin",
      email: ACCOUNTS.admin.email,
      fullName: ACCOUNTS.admin.fullName,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  console.log(`users/admin ready: ${ACCOUNTS.admin.email} / ${ACCOUNTS.admin.password}`);
  return user;
}

async function seedStudent(account, { firstName, lastName, curriculum, track, yearLevel }) {
  const user = await upsertAuthUser(account);
  const studentRef = db.collection("students").doc(user.uid);
  await studentRef.set(
    {
      firstName,
      lastName,
      fullName: account.fullName,
      email: account.email,
      college: "College of Information and Communications Technology",
      course: "BSIT",
      curriculum,
      track,
      yearLevel,
      studentType: "Regular",
      academicYear: "2025-2026",
      status: "Pending",
      uid: user.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  await db.collection("users").doc(user.uid).set(
    {
      role: "student",
      email: account.email,
      fullName: account.fullName,
      studentId: studentRef.id,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  console.log(`users/student ready: ${account.email} / ${account.password} (${curriculum} curriculum, ${yearLevel})`);
  return studentRef.id;
}

async function creditSubjects(studentId, subjects, { from, grade }) {
  if (!subjects.length) return;
  const batch = db.batch();
  subjects.forEach((s) => {
    batch.set(db.collection("creditedSubjects").doc(`${studentId}_${s.id}`), {
      studentId,
      subjectId: s.id,
      creditedFrom: from,
      grade,
      remarks: "Seeded sample data",
      creditedBy: ACCOUNTS.admin.email,
      creditedAt: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  console.log(`creditedSubjects: credited ${subjects.length} subject(s) for student ${studentId}.`);
}

async function assignSubjects(studentId, subjects) {
  if (!subjects.length) return;
  const batch = db.batch();
  subjects.forEach((s) => {
    batch.set(db.collection("studentSubjects").doc(`${studentId}_${s.id}`), {
      studentId,
      subjectId: s.id,
      assignedAt: FieldValue.serverTimestamp(),
      overload: false
    });
  });
  await batch.commit();
  console.log(`studentSubjects: assigned ${subjects.length} subject(s) to student ${studentId}.`);
}

// Two illustrative Course Match review cases so the admin's Course Matches
// page (and the strict-matching Credit Evaluation flow) has something real
// to show. None of the actual New/Old catalog code overlaps happen to have
// mismatched names (checked - every shared code has an identical name), so
// these simulate the "an admin typed a slightly different external course
// name" scenario the feature is actually designed to catch.
async function seedCourseMatchExceptions(oldSubjects) {
  const db211 = oldSubjects.find((s) => s.subjectCode === "IT 211");
  const cs121 = oldSubjects.find((s) => s.subjectCode === "CS 121");
  const batch = db.batch();

  if (db211) {
    batch.set(db.collection("courseMatchExceptions").doc(`manual_${db211.id}_IT211DBSYS`), {
      oldSubjectId: db211.id,
      newSubjectId: null,
      oldCode: db211.subjectCode,
      oldName: db211.subjectName,
      newCode: "IT211",
      newName: "Database Systems (transfer credit)",
      status: "pending",
      detectedAt: FieldValue.serverTimestamp()
    });
  }
  if (cs121) {
    batch.set(db.collection("courseMatchExceptions").doc(`manual_${cs121.id}_CS121ACP`), {
      oldSubjectId: cs121.id,
      newSubjectId: null,
      oldCode: cs121.subjectCode,
      oldName: cs121.subjectName,
      newCode: "CS121",
      newName: "Advanced Computer Programming (ACP)",
      status: "accepted",
      reviewedBy: ACCOUNTS.admin.email,
      reviewedAt: FieldValue.serverTimestamp(),
      detectedAt: FieldValue.serverTimestamp()
    });
  }

  await batch.commit();
  console.log("courseMatchExceptions: seeded 1 pending + 1 accepted example.");
}

async function seedActivityLogs(adminUid) {
  const actions = [
    "Added student Juan Dela Cruz",
    "Added student Maria Santos",
    "Updated subject assignments for student (seed data)",
    "Saved credited subject for student (seed data)",
    "Course match manual_CS121 marked accepted"
  ];
  const batch = db.batch();
  actions.forEach((action) => {
    batch.set(db.collection("activityLogs").doc(), {
      userId: adminUid,
      email: ACCOUNTS.admin.email,
      action,
      timestamp: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  console.log(`activityLogs: seeded ${actions.length} entries.`);
}

async function main() {
  const newSubjects = withIds(newCurriculum.SUBJECTS, "new", {
    track: newCurriculum.TRACK,
    curriculum: "New",
    academicYear: newCurriculum.ACADEMIC_YEAR
  });
  const oldSubjects = withIds(oldCurriculum.SUBJECTS, "old", {
    curriculum: "Old",
    academicYear: oldCurriculum.ACADEMIC_YEAR
  });

  await seedSubjects(newSubjects, oldSubjects);
  await seedSettings();
  const adminUser = await seedAdmin();

  const juanId = await seedStudent(ACCOUNTS.studentNew, {
    firstName: "Juan",
    lastName: "Dela Cruz",
    curriculum: "New",
    track: "General",
    yearLevel: "1st Year"
  });
  // Juan just enrolled: nothing credited yet, currently taking his first term.
  await assignSubjects(
    juanId,
    newSubjects.filter((s) => s.yearLevel === "1st Year" && s.semester === "1st Semester")
  );

  const mariaId = await seedStudent(ACCOUNTS.studentOld, {
    firstName: "Maria",
    lastName: "Santos",
    curriculum: "Old",
    track: "Network Technology",
    yearLevel: "3rd Year"
  });
  const mariaRequired = oldSubjects.filter(
    (s) => !s.track || s.track === "Network Technology" || s.track === "All Tracks"
  );
  // Maria is a regular 3rd year: Years 1-2 already completed, taking her
  // 3rd-year 1st-semester load now.
  await creditSubjects(
    mariaId,
    mariaRequired.filter((s) => s.yearLevel === "1st Year" || s.yearLevel === "2nd Year"),
    { from: "Completed at Nexus", grade: 1.75 }
  );
  await assignSubjects(
    mariaId,
    mariaRequired.filter((s) => s.yearLevel === "3rd Year" && s.semester === "1st Semester")
  );

  await seedCourseMatchExceptions(oldSubjects);
  await seedActivityLogs(adminUser.uid);

  console.log("\nLocal database ready. Open http://127.0.0.1:5000 (admin-login.html / student-login.html) and sign in with the accounts above.");
  console.log("Browse/edit the raw data at the Emulator UI: http://127.0.0.1:4000");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to seed local emulator:", err);
  process.exit(1);
});
