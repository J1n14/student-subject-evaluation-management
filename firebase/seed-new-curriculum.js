/**
 * One-time script: seeds the New-curriculum BSIT subject catalog (Batangas
 * State University, JPLPC Malvar Campus, AY 2021-2022) across all three
 * tracks into the `subjects` collection.
 *
 * The catalog had 57 untagged "legacy" subjects left over from before the
 * Credit Evaluation feature existed. Where one of those legacy subjects has
 * the same subjectCode as a course in this official curriculum, its
 * document is UPDATED in place (preserving its doc ID, so any existing
 * assignments/credits stay valid) instead of creating a duplicate. Legacy
 * subjects whose code appears in neither official curriculum (Old or New)
 * are deleted outright, along with any assignments/credited-subject records
 * tied to them.
 *
 * Brand-new subjects (no matching legacy doc) get deterministic doc IDs
 * (`new_<CodeWithoutSpaces>`) with `{ merge: true }`, so re-running this
 * script is safe.
 *
 * Requires serviceAccountKey.json (same as create-admin.js).
 *
 * Usage:
 *   node seed-new-curriculum.js
 */
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const ACADEMIC_YEAR = "2025-2026";

// track: "All Tracks" = shared GE/common/professional courses taken by every
// BSIT student regardless of track. Track-specific electives use the
// student's actual track name.
const SUBJECTS = [
  // ---- Year 1, 1st Semester (shared) ----
  { subjectCode: "IT 111", subjectName: "Introduction to Computing", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 102", subjectName: "Mathematics in the Modern World", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 108", subjectName: "Art Appreciation", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "FILI 101", subjectName: "Kontekstwalisadong Komunikasyon sa Filipino", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "PATHFit 1", subjectName: "Movement Competency Training", units: 2, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "NSTP 111", subjectName: "National Service Training Program 1", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 103", subjectName: "The Life and Works of Rizal", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 104", subjectName: "The Contemporary World", units: 3, yearLevel: "1st Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },

  // ---- Year 1, 2nd Semester (shared) ----
  { subjectCode: "CS 111", subjectName: "Computer Programming", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 111" },
  { subjectCode: "CS 131", subjectName: "Data Structures and Algorithms", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 111" },
  { subjectCode: "MATH 111", subjectName: "Linear Algebra", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "GEd 102" },
  { subjectCode: "FILI 102", subjectName: "Filipino sa Iba't Ibang Disiplina", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 105", subjectName: "Readings in Philippine History", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 109", subjectName: "Science, Technology and Society", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "PATHFit 2", subjectName: "Exercise-Based Fitness Activities", units: 2, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "PATHFit 1" },
  { subjectCode: "NSTP 121", subjectName: "National Service Training Program 2", units: 3, yearLevel: "1st Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "NSTP 111" },

  // ---- Year 2, 1st Semester (shared) ----
  { subjectCode: "CS 121", subjectName: "Advanced Computer Programming", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "CS 111" },
  { subjectCode: "IT 211", subjectName: "Database Management System", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "CS 111" },
  { subjectCode: "CS 211", subjectName: "Object-Oriented Programming", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "CS 111, CS 131" },
  { subjectCode: "LITR 102", subjectName: "ASEAN Literature", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "CpE 405", subjectName: "Discrete Mathematics", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "MATH 111" },
  { subjectCode: "PHY 101", subjectName: "Calculus Based Physics", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "MATH 111" },
  { subjectCode: "IT 212", subjectName: "Computer Networking 1", units: 3, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 111" },
  { subjectCode: "PATHFit 3", subjectName: "Traditional and Recreational Games", units: 2, yearLevel: "2nd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "PATHFit 1, PATHFit 2" },

  // ---- Year 2, 2nd Semester (shared) ----
  { subjectCode: "IT 221", subjectName: "Information Management", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 111" },
  { subjectCode: "IT 223", subjectName: "Computer Networking 2", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 212" },
  { subjectCode: "IT 222", subjectName: "Advanced Database Management System", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 211" },
  { subjectCode: "MATH 408", subjectName: "Data Analysis", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "MATH 111" },
  { subjectCode: "ES 101", subjectName: "Environmental Sciences", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "PHY 101" },
  { subjectCode: "GEd 106", subjectName: "Purposive Communication", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "GEd 101", subjectName: "Understanding the Self", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "PATHFit 4", subjectName: "Team Sports (Basketball and Volleyball)", units: 2, yearLevel: "2nd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "PATHFit 1, PATHFit 2" },

  // ---- Year 3, 1st Semester (shared) ----
  { subjectCode: "IT 311", subjectName: "Systems Administration and Maintenance", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 221, IT 222" },
  { subjectCode: "IT 312", subjectName: "System Integration and Architecture", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "CS 131" },
  { subjectCode: "IT 313", subjectName: "System Analysis and Design", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 222" },
  { subjectCode: "IT 314", subjectName: "Web Systems and Technologies", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "CS 211" },
  { subjectCode: "GEd 107", subjectName: "Ethics", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },

  // ---- Year 3, 1st Semester (track electives) ----
  { subjectCode: "NTT 401", subjectName: "Computer Networking 3", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "Network Technology", prerequisite: "IT 223" },
  { subjectCode: "NTT 402", subjectName: "Internet of Things (IoT)", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "Network Technology", prerequisite: "IT 223" },
  { subjectCode: "BAT 401", subjectName: "Fundamentals of Business Analytics", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "Business Analytics", prerequisite: "IT 221, IT 222" },
  { subjectCode: "BAT 402", subjectName: "Fundamentals of Analytics Modeling", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "Business Analytics", prerequisite: "IT 221, IT 222" },
  { subjectCode: "SMT 401", subjectName: "Fundamentals of Business Process Outsourcing 101", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "Service Management", prerequisite: "IT 221" },
  { subjectCode: "SMT 402", subjectName: "Business Communication", units: 3, yearLevel: "3rd Year", semester: "1st Semester", track: "Service Management", prerequisite: "IT 221" },

  // ---- Year 3, 2nd Semester (shared) ----
  { subjectCode: "IT 321", subjectName: "Human-computer Interaction", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 314" },
  { subjectCode: "IT 322", subjectName: "Advanced System Integration and Architecture", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 312" },
  { subjectCode: "IT 323", subjectName: "Information Assurance and Security", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 223" },
  { subjectCode: "IT 324", subjectName: "Capstone Project 1", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" }, // prereq is standing "3rd Year Standing", not a subject code
  { subjectCode: "IT 325", subjectName: "IT Project Management", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "IT 313" },

  // ---- Year 3, 2nd Semester (track electives) ----
  { subjectCode: "NTT 403", subjectName: "Computer Networking 4", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "Network Technology", prerequisite: "NTT 401" },
  { subjectCode: "NTT 404", subjectName: "Cloud Computing", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "Network Technology", prerequisite: "NTT 402" },
  { subjectCode: "BAT 403", subjectName: "Fundamentals of Enterprise Data Management", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "Business Analytics", prerequisite: "BAT 401" },
  { subjectCode: "BAT 404", subjectName: "Analytics Techniques & Tools", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "Business Analytics", prerequisite: "BAT 402" },
  { subjectCode: "SMT 403", subjectName: "Fundamentals of Business Process Outsourcing 102", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "Service Management", prerequisite: "SMT 401" },
  { subjectCode: "SMT 404", subjectName: "Service Culture", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", track: "Service Management", prerequisite: "SMT 401" },

  // ---- Year 3, Midterm (shared) ----
  { subjectCode: "IT 331", subjectName: "Application Development and Emerging Technologies", units: 3, yearLevel: "3rd Year", semester: "Midterm", track: "All Tracks", prerequisite: "IT 321" },
  { subjectCode: "IT 332", subjectName: "Integrative Programming and Technologies", units: 3, yearLevel: "3rd Year", semester: "Midterm", track: "All Tracks", prerequisite: "IT 314" },

  // ---- Year 4, 1st Semester (shared) ----
  { subjectCode: "CS 423", subjectName: "Social Issues and Professional Practice", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "IT 411", subjectName: "Capstone Project 2", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 324" },
  { subjectCode: "ENGG 405", subjectName: "Technopreneurship", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "All Tracks", prerequisite: "" },
  { subjectCode: "IT 413", subjectName: "Advanced Information Assurance and Security", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 323" },
  { subjectCode: "IT 414", subjectName: "System Quality Assurance", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 325" },
  { subjectCode: "IT 412", subjectName: "Platform Technologies", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "All Tracks", prerequisite: "IT 332" },

  // ---- Year 4, 1st Semester (track electives) ----
  { subjectCode: "NTT 405", subjectName: "Cybersecurity", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "Network Technology", prerequisite: "NTT 403" },
  { subjectCode: "BAT 405", subjectName: "Analytics Application", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "Business Analytics", prerequisite: "BAT 404" },
  { subjectCode: "SMT 405", subjectName: "Principles of System Thinking", units: 3, yearLevel: "4th Year", semester: "1st Semester", track: "Service Management", prerequisite: "SMT 403" },

  // ---- Year 4, 2nd Semester (shared) ----
  { subjectCode: "IT 421", subjectName: "Internship Training", units: 6, yearLevel: "4th Year", semester: "2nd Semester", track: "All Tracks", prerequisite: "" } // prereq is standing "4th Year Standing", not a subject code
];

async function cascadeDelete(batch, subjectId) {
  const [assignSnap, creditSnap] = await Promise.all([
    db.collection("studentSubjects").where("subjectId", "==", subjectId).get(),
    db.collection("creditedSubjects").where("subjectId", "==", subjectId).get()
  ]);
  assignSnap.forEach((d) => batch.delete(d.ref));
  creditSnap.forEach((d) => batch.delete(d.ref));
}

async function main() {
  const snap = await db.collection("subjects").get();
  const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Only untagged (pre-existing, no curriculum field) docs are eligible to be
  // reused/updated in place - never touch anything already tagged "Old".
  const legacyByCode = new Map();
  allDocs.forEach((d) => {
    if (!d.curriculum) legacyByCode.set(d.subjectCode, d);
  });

  const newCodes = new Set(SUBJECTS.map((s) => s.subjectCode));

  const batch = db.batch();
  let updatedCount = 0;
  let createdCount = 0;

  for (const s of SUBJECTS) {
    const legacyMatch = legacyByCode.get(s.subjectCode);
    const ref = legacyMatch ? db.collection("subjects").doc(legacyMatch.id) : db.collection("subjects").doc(`new_${s.subjectCode.replace(/\s+/g, "")}`);
    batch.set(
      ref,
      {
        ...s,
        curriculum: "New",
        academicYear: ACADEMIC_YEAR,
        status: "Active",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    if (legacyMatch) updatedCount++;
    else createdCount++;
  }

  // Delete every untagged legacy subject whose code isn't part of this
  // official curriculum - it's ad-hoc placeholder data, not a real course.
  const toDelete = allDocs.filter((d) => !d.curriculum && !newCodes.has(d.subjectCode));
  for (const d of toDelete) {
    batch.delete(db.collection("subjects").doc(d.id));
    await cascadeDelete(batch, d.id);
  }

  await batch.commit();
  console.log(`Updated ${updatedCount} existing subjects, created ${createdCount} new ones, deleted ${toDelete.length} unofficial legacy subjects.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
