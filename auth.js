/**
 * Authentication + route-protection helpers.
 * Requires firebase-config.js loaded first.
 *
 * Data model reminder (see README.md):
 *   users/{uid} = { role: 'admin' | 'student', email, fullName, studentId, createdAt, updatedAt }
 */

// Resolve the users/{uid} profile doc for the currently signed-in user.
async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.collection("users").doc(user.uid).get();
  return snap.exists ? { uid: user.uid, ...snap.data() } : null;
}

/**
 * Guards a page so only a signed-in user with the given role can view it.
 * Redirects to the appropriate login page otherwise.
 * Call this at the top of every protected page's inline <script>.
 *
 * @param {'admin'|'student'} requiredRole
 * @param {(profile: object) => void} onReady - called once with the verified profile
 */
function requireRole(requiredRole, onReady) {
  const loginPage = requiredRole === "admin" ? "admin-login.html" : "index.html";
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = loginPage;
      return;
    }
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

// ---------- Admin login ----------
async function adminLogin(email, password) {
  const cred = await auth.signInWithEmailAndPassword(email, password);
  const snap = await db.collection("users").doc(cred.user.uid).get();
  if (!snap.exists || snap.data().role !== "admin") {
    await auth.signOut();
    throw new Error("This account is not registered as an Admin.");
  }
  await logActivity("Admin login");
  return snap.data();
}

// ---------- Student login ----------
async function studentLogin(email, password) {
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
