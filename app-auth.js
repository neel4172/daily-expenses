/**
 * @file app-auth.js
 * @brief Firebase Authentication (email + password) and Firestore sync for Daily Expenses.
 *
 * Wraps Firestore in the small store API that index.html uses
 * (doc/collection, get/set/update/delete/onSnapshot) and drives the
 * sign-in screen. Each user's data lives under data/users/{uid}/ and
 * firestore.rules makes it readable and writable only by that user.
 */
import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc as fsDoc, collection as fsCollection, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const App = window.ExpenseApp;
const $ = id => document.getElementById(id);

/* ---------- config check ---------- */
if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith("PASTE")) {
  App.lockShow("Setup needed", "Add your Firebase project settings to firebase-config.js (see README.md), then reload.");
  throw new Error("Firebase config missing");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence).catch(() => {});

let fs;
try {
  // Offline cache: entries made without signal are saved on the phone and sync later.
  fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  fs = initializeFirestore(app, {});
}

/* ---------- store adapter ---------- */

/** Map Firebase errors to the codes index.html understands. */
const mapErr = e => ({ code: e?.code === "permission-denied" ? "invalid_argument" : (e?.code || "unavailable"), message: e?.message || "" });

/**
 * Resolve a write quickly even when offline (Firestore queues it locally and
 * syncs later); still reject if the server refuses it right away.
 * @param {Promise} p the Firestore write
 */
function quickWrite(p) {
  p.catch(() => {});
  return Promise.race([p.catch(e => { throw mapErr(e); }), new Promise(r => setTimeout(r, 1500))]);
}

/** @param {import("firebase/firestore").DocumentSnapshot} s */
const snapDoc = s => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });

/** Wrap a Firestore document reference. */
function wrapDoc(ref) {
  return {
    id: ref.id, path: ref.path,
    get: async () => { try { return snapDoc(await getDoc(ref)); } catch (e) { throw mapErr(e); } },
    set: data => quickWrite(setDoc(ref, data)),
    update: data => quickWrite(updateDoc(ref, data)),
    delete: () => quickWrite(deleteDoc(ref)),
    onSnapshot: (next, error) => onSnapshot(ref, { includeMetadataChanges: true }, s => next(snapDoc(s)), e => error && error(mapErr(e))),
    collection: p => wrapColl(fsCollection(ref, p))
  };
}

/** Wrap a Firestore collection reference. */
function wrapColl(ref) {
  return {
    path: ref.path,
    doc: id => wrapDoc(id ? fsDoc(ref, id) : fsDoc(ref)),
    onSnapshot: (next, error) => onSnapshot(ref, { includeMetadataChanges: true },
      s => next({ docs: s.docs.map(snapDoc), size: s.size, empty: s.empty, metadata: s.metadata }),
      e => error && error(mapErr(e)))
  };
}

const store = { doc: p => wrapDoc(fsDoc(fs, p)), collection: p => wrapColl(fsCollection(fs, p)) };

/* ---------- sign-in screen ---------- */
let creating = false;

/** Show the email/password form. */
function showAuth() {
  App.showPanel("auth");
  App.lockShow(creating ? "Create your account" : "Daily Expenses",
    creating ? "Your expenses stay private to your account and sync on every device." : "Sign in to see your expenses.");
  $("aPass2").style.display = creating ? "block" : "none";
  $("aBtn").textContent = creating ? "Create account" : "Sign in";
  $("aToggle").textContent = creating ? "Already have an account? Sign in" : "New here? Create an account";
  $("aForgot").style.display = creating ? "none" : "inline-block";
  $("aPass").autocomplete = creating ? "new-password" : "current-password";
  $("aErr").textContent = "";
}

/** Friendly text for Firebase Auth error codes. */
function authMsg(code) {
  return ({
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "Wrong email or password.",
    "auth/email-already-in-use": "An account with this email already exists – sign in instead.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
    "auth/network-request-failed": "No internet connection."
  })[code] || "Something went wrong. Please try again.";
}

$("aToggle").onclick = () => { creating = !creating; showAuth(); };

$("aBtn").onclick = async () => {
  const email = $("aEmail").value.trim(), pass = $("aPass").value;
  if (!email || !pass) { $("aErr").textContent = "Enter your email and password."; return; }
  if (creating && pass !== $("aPass2").value) { $("aErr").textContent = "Passwords don't match."; return; }
  $("aBtn").disabled = true; $("aErr").textContent = "";
  try {
    if (creating) await createUserWithEmailAndPassword(auth, email, pass);
    else await signInWithEmailAndPassword(auth, email, pass);
    $("aPass").value = ""; $("aPass2").value = "";
  } catch (e) { $("aErr").textContent = authMsg(e.code); }
  finally { $("aBtn").disabled = false; }
};
["aEmail", "aPass", "aPass2"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter") $("aBtn").click(); }));

$("aForgot").onclick = async () => {
  const email = $("aEmail").value.trim();
  if (!email) { $("aErr").textContent = "Type your email above first."; return; }
  try { await sendPasswordResetEmail(auth, email); $("aErr").textContent = "If that account exists, a reset link is on its way. Check your inbox."; }
  catch (e) { $("aErr").textContent = authMsg(e.code); }
};

$("signOut").onclick = () => signOut(auth);

/* ---------- session ---------- */
onAuthStateChanged(auth, user => {
  if (user) {
    App.showPanel("none");
    App.lockShow("Daily Expenses", "Loading your data…");
    App.startSession(store, user.uid, user.email);
  } else {
    App.endSession();
    showAuth();
  }
});
