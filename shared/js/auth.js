async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await db.collection("users").doc(user.uid).get();
  return snap.exists ? { uid: user.uid, ...snap.data() } : null;
}

// Called at the top of every protected admin/html or student/html page.
function requireRole(requiredRole, onReady) {
  const loginPage = requiredRole === "admin" ? "../../admin-login.html" : "../../index.html";
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
