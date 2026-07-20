/**
 * One-time script: seeds the New-curriculum BSIT subject catalog (Batangas
 * State University, Golden Country Homes / Alangilan campus) into the
 * `subjects` collection. This curriculum has no track split - every
 * subject applies to every track ("All Tracks").
 *
 * The app's original 57 untagged "legacy" subjects (created before the
 * Credit Evaluation feature existed) turned out to BE this exact
 * curriculum, just missing prerequisites/track/curriculum tags. Where a
 * legacy subject's code matches a course here, its document is updated in
 * place (preserving its doc ID, so any existing assignments/credits stay
 * valid) instead of creating a duplicate. Anything tagged curriculum:"New"
 * that doesn't belong to this curriculum is deleted, along with any
 * assignments/credited-subject records tied to it - this makes the script
 * safe to re-run even after a bad previous seed.
 *
 * Requires serviceAccountKey.json (same as create-admin.js).
 *
 * Usage:
 *   node seed-new-curriculum.js
 */
const ACADEMIC_YEAR = "2025-2026";

// This curriculum has no track split (confirmed) - every subject applies
// to every track.
const TRACK = "All Tracks";

const SUBJECTS = [
  // ---- Year 1, 1st Semester ----
  { subjectCode: "CC 100", subjectName: "Introduction to Computing", units: 3, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "CC 101", subjectName: "Computer Programming", units: 3, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "MATH 101", subjectName: "Differential Calculus", units: 4, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "GEd 101", subjectName: "Understanding the Self", units: 3, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "GEd 102", subjectName: "Mathematics in the Modern World", units: 3, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "GEd 105", subjectName: "Readings in Philippine History", units: 3, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "PATHFit 1", subjectName: "Movement Competency Training", units: 2, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "NSTP 111", subjectName: "National Service Training Program 1", units: 3, yearLevel: "1st Year", semester: "1st Semester", prerequisite: "" },

  // ---- Year 1, 2nd Semester ----
  { subjectCode: "CC 102", subjectName: "Advanced Computer Programming", units: 3, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "CC 100, CC 101" },
  { subjectCode: "CC 103", subjectName: "Data Structures and Algorithms", units: 3, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "CC 100, CC 101" },
  { subjectCode: "CpE 405", subjectName: "Discrete Mathematics", units: 3, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "MATH 101" },
  { subjectCode: "MATH 102", subjectName: "Integral Calculus", units: 4, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "MATH 101" },
  { subjectCode: "GEd 108", subjectName: "Art Appreciation", units: 3, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "" },
  { subjectCode: "GEd 109", subjectName: "Science, Technology and Society", units: 3, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "" },
  { subjectCode: "PATHFit 2", subjectName: "Exercise-Based Fitness Activities", units: 2, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "PATHFit 1" },
  { subjectCode: "NSTP 121", subjectName: "National Service Training Program 2", units: 3, yearLevel: "1st Year", semester: "2nd Semester", prerequisite: "NSTP 111" },

  // ---- Year 2, 1st Semester ----
  { subjectCode: "CC 104", subjectName: "Information Management", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "CC 103" },
  { subjectCode: "OOP 101", subjectName: "Object-Oriented Programming", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "CC 102, CC 103" },
  { subjectCode: "PT 101", subjectName: "Platform Technologies", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "CC 102, CC 103" },
  { subjectCode: "NET 101", subjectName: "Fundamentals of Computer Networking", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "CC 100" },
  { subjectCode: "PHYS 111", subjectName: "General Physics 1", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "MATH 101" },
  { subjectCode: "AI 101", subjectName: "Linear Algebra for AI", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "GEd 107", subjectName: "Ethics", units: 3, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "PATHFit 3", subjectName: "Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor, and Adventure Activities 1", units: 2, yearLevel: "2nd Year", semester: "1st Semester", prerequisite: "PATHFit 1, PATHFit 2" },

  // ---- Year 2, 2nd Semester ----
  { subjectCode: "DB 101", subjectName: "Database Management System", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "CC 104" },
  { subjectCode: "NET 102", subjectName: "Advanced Computer Networking", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "CC 102, NET 101" },
  { subjectCode: "SAM 101", subjectName: "System Administration and Maintenance", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "CC 104, NET 101" },
  { subjectCode: "PHYS 112", subjectName: "General Physics 2", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "PHYS 111" },
  { subjectCode: "AI 102", subjectName: "Probability and Statistics for AI", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "MATH 102" },
  { subjectCode: "GEd 104", subjectName: "The Contemporary World", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "" },
  { subjectCode: "GEd 106", subjectName: "Purposive Communication", units: 3, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "" },
  { subjectCode: "PATHFit 4", subjectName: "Choice of Dance, Sports, Martial Arts, Group Exercise, Outdoor, and Adventure Activities 2", units: 2, yearLevel: "2nd Year", semester: "2nd Semester", prerequisite: "PATHFit 1, PATHFit 2" },

  // ---- Year 2, Midterm ----
  { subjectCode: "CSAI 100", subjectName: "Artificial Intelligence", units: 3, yearLevel: "2nd Year", semester: "Midterm", prerequisite: "AI 101, AI 102, CpE 405" },
  { subjectCode: "QM 101", subjectName: "Quantitative Methods", units: 3, yearLevel: "2nd Year", semester: "Midterm", prerequisite: "AI 102, CpE 405" },

  // ---- Year 3, 1st Semester ----
  { subjectCode: "DB 102", subjectName: "Advanced Database Management System", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "DB 101" },
  { subjectCode: "IAS 101", subjectName: "Information Assurance and Security", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "NET 101, CC 101" },
  { subjectCode: "SIA 101", subjectName: "System Integration and Architecture", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "SAM 101" },
  { subjectCode: "SAD 101", subjectName: "Systems Analysis and Design", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "DB 101, OOP 101" },
  { subjectCode: "HCI 101", subjectName: "Human-Computer Interaction", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "CC 102" },
  { subjectCode: "AI 103", subjectName: "Machine Learning and Neural Networks", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "CSAI 100, CC 102" },
  { subjectCode: "GEd 110", subjectName: "Advanced Technical Writing", units: 3, yearLevel: "3rd Year", semester: "1st Semester", prerequisite: "" },

  // ---- Year 3, 2nd Semester ----
  { subjectCode: "CP 101", subjectName: "Capstone Project 1", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "" }, // prereq is standing "3rd Year Standing", not a subject code
  { subjectCode: "IAS 102", subjectName: "Advanced Information Assurance and Security", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "IAS 101" },
  { subjectCode: "SIA 102", subjectName: "Advanced System Integration and Architecture", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "SIA 101" },
  { subjectCode: "IPT 101", subjectName: "Integrative Programming and Technologies", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "SAD 101" },
  { subjectCode: "WS 101", subjectName: "Web Systems and Technologies", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "CC 104, OOP 101" },
  { subjectCode: "ELEC 101", subjectName: "Professional Elective 1", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "" }, // prereq is standing "3rd Year Standing"
  { subjectCode: "GEd 111", subjectName: "Advanced Oral Communication", units: 3, yearLevel: "3rd Year", semester: "2nd Semester", prerequisite: "" },

  // ---- Year 3, Midterm ----
  { subjectCode: "ITPM 101", subjectName: "IT Project Management", units: 3, yearLevel: "3rd Year", semester: "Midterm", prerequisite: "SAD 101" },
  { subjectCode: "SQA 101", subjectName: "System Quality Assurance", units: 3, yearLevel: "3rd Year", semester: "Midterm", prerequisite: "SAD 101" },

  // ---- Year 4, 1st Semester ----
  { subjectCode: "CP 102", subjectName: "Capstone Project 2", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "CP 101" },
  { subjectCode: "CC 105", subjectName: "Application Development and Emerging Technologies", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "OOP 101" },
  { subjectCode: "SIP 101", subjectName: "Social Issues and Professional Practice", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "CC 100" },
  { subjectCode: "ELEC 102", subjectName: "Professional Elective 2", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "" }, // prereq is standing "4th Year Standing"
  { subjectCode: "ELEC 103", subjectName: "Professional Elective 3", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "" }, // prereq is standing "4th Year Standing"
  { subjectCode: "ENGG 105", subjectName: "Technopreneurship", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "" },
  { subjectCode: "GEd 103", subjectName: "The Life and Works of Rizal", units: 3, yearLevel: "4th Year", semester: "1st Semester", prerequisite: "" },

  // ---- Year 4, 2nd Semester ----
  // NOTE: this page of the source document wasn't available; code/details
  // are inferred to match the other two curricula's Internship course.
  // Correct via the Subjects panel if the real code/units differ.
  { subjectCode: "OJT 101", subjectName: "Internship Training", units: 6, yearLevel: "4th Year", semester: "2nd Semester", prerequisite: "" }
];

module.exports = { SUBJECTS, TRACK, ACADEMIC_YEAR };

// Only run as a one-time production seed when executed directly
// (`node seed-new-curriculum.js`) - not when required by seed-emulator.js.
if (require.main === module) {
  const { initializeApp, cert } = require("firebase-admin/app");
  const { getFirestore, FieldValue } = require("firebase-admin/firestore");
  const serviceAccount = require("./serviceAccountKey.json");

  initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  runSeed(db, FieldValue).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

async function cascadeDelete(db, batch, subjectId) {
  const [assignSnap, creditSnap] = await Promise.all([
    db.collection("studentSubjects").where("subjectId", "==", subjectId).get(),
    db.collection("creditedSubjects").where("subjectId", "==", subjectId).get()
  ]);
  assignSnap.forEach((d) => batch.delete(d.ref));
  creditSnap.forEach((d) => batch.delete(d.ref));
}

async function runSeed(db, FieldValue) {
  const snap = await db.collection("subjects").get();
  const allDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const targetCodes = new Set(SUBJECTS.map((s) => s.subjectCode));
  const existingNewByCode = new Map();
  allDocs.forEach((d) => {
    if (d.curriculum === "New") existingNewByCode.set(d.subjectCode, d);
    if (!d.curriculum) existingNewByCode.set(d.subjectCode, d); // legacy untagged docs are New-curriculum candidates too
  });

  const batch = db.batch();
  let deletedWrong = 0;
  let reused = 0;
  let created = 0;

  // 1) Remove every "New"-tagged doc that doesn't belong to this curriculum.
  for (const d of allDocs) {
    if (d.curriculum === "New" && !targetCodes.has(d.subjectCode)) {
      batch.delete(db.collection("subjects").doc(d.id));
      await cascadeDelete(db, batch, d.id);
      deletedWrong++;
    }
  }

  // 2) Upsert the correct New-curriculum subjects.
  for (const s of SUBJECTS) {
    const existing = existingNewByCode.get(s.subjectCode);
    const ref = existing ? db.collection("subjects").doc(existing.id) : db.collection("subjects").doc(`new_${s.subjectCode.replace(/\s+/g, "")}`);
    batch.set(
      ref,
      {
        ...s,
        track: TRACK,
        curriculum: "New",
        academicYear: ACADEMIC_YEAR,
        status: "Active",
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    if (existing) reused++;
    else created++;
  }

  await batch.commit();
  console.log(`Deleted ${deletedWrong} wrongly-tagged subjects, reused ${reused} existing docs, created ${created} new ones.`);
}
