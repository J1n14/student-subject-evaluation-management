async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.collection("users").doc(user.uid).get();
  return snap.exists ? { uid: user.uid, ...snap.data() } : null;
}

// Called at the top of every protected admin/html or student/html page.
// A single stray "no user yet" callback right after a full-page redirect
// (before Firebase Auth finishes rehydrating the session from storage) used
// to send people straight back to the login page, requiring a second login.
// We now give the SDK one short grace window to settle before bouncing.
function requireRole(requiredRole, onReady) {
  const loginPage = requiredRole === "admin" ? "../../admin-login.html" : "../../student-login.html";
  let settled = false;
  let sawNullFirst = false;

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      if (!settled && !sawNullFirst) {
        // First callback came back empty - could be a genuine logged-out
        // visitor, or the SDK still rehydrating right after a redirect.
        // Wait briefly and re-check auth.currentUser directly before
        // deciding this is a real "not logged in" state.
        sawNullFirst = true;
        setTimeout(() => {
          if (settled) return;
          if (auth.currentUser) return; // a later callback already handled it
          settled = true;
          window.location.href = loginPage;
        }, 700);
        return;
      }
      if (settled) return;
      settled = true;
      window.location.href = loginPage;
      return;
    }
    if (settled) return;
    settled = true;
    try {
      const profile = await getCurrentUserProfile();
      if (!profile || profile.role !== requiredRole) {
        showToast("You don't have access to that area.", "error");
        await auth.signOut();
        window.location.href = loginPage;
        return;
      }
      onReady(profile);
    } catch (err) {
      console.error(err);
      window.location.href = loginPage;
    }
  });
}

async function adminLogin(email, password) {
  await authPersistenceReady;
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const snap = await db.collection("users").doc(cred.user.uid).get();
  if (!snap.exists || snap.data().role !== "admin") {
    await auth.signOut();
    throw new Error("This account is not registered as an Admin.");
  }
  await logActivity("Admin login");
  return snap.data();
}

async function studentLogin(email, password) {
  await authPersistenceReady;
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const snap = await db.collection("users").doc(cred.user.uid).get();
  if (!snap.exists || snap.data().role !== "student") {
    await auth.signOut();
    throw new Error("This account is not registered as a Student.");
  }
  await logActivity("Student login");
  return snap.data();
}

async function logout(redirectTo = "index.html") {
  const user = auth.currentUser;
  if (user) await logActivity("Logout");
  await auth.signOut();
  window.location.href = redirectTo;
}
