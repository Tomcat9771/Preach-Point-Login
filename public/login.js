// /public/login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  setPersistence, browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";

// Firebase config (your project)
const firebaseConfig = {
  apiKey: "AIzaSyB6mjVxBIW8d2dMD6jRe9MD257qsNC2Ia0",
  authDomain: "preach-point.firebaseapp.com",
  projectId: "preach-point",
  storageBucket: "preach-point.firebasestorage.app",
  messagingSenderId: "699269130347",
  appId: "1:699269130347:web:a6617996b042821089692e",
  measurementId: "G-3L6CZ43J51"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);
window.__auth = auth; // let other scripts use token if needed

// ===== helpers =====
function setText(id, t){ const el=document.getElementById(id); if (el) el.textContent=t; }

// ===== UI refs =====
const msg     = document.getElementById('msg');
const emailEl = document.getElementById('email');
const passEl  = document.getElementById('pass');

// ===== auth state =====
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Stay on the login page, but let the user enter the app if desired
    const el = document.getElementById('msg');
    if (el) {
      el.textContent = "You're already signed in.";
      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.textContent = 'Enter App';
      btn.onclick = () => location.href = '/index.html';
      el.appendChild(btn);
    }
  } else {
    setText('msg', 'Not signed in.');
  }
});

// ===== buttons =====
document.getElementById('btnSignup').onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailEl.value, passEl.value);
    ppAlert('Account created & signed in. You must complete payment before accessing the app.');
    location.href = '/subscribe.html';
  } catch (e) {
    const msg = e.code === 'auth/email-already-in-use'
      ? 'Email already in use'
      : (e.message || e);
    ppAlert(msg);
  }
};
document.getElementById('btnSignin').onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, emailEl.value, passEl.value);
    location.href = '/index.html';
  } catch (e) {
    const msg = e.code === 'auth/invalid-credential'
      ? 'User not Subscribed. Please create account'
      : (e.message || e);
    ppAlert(msg);
  }
};
document.getElementById('btnSignout').onclick = async () => {
  await signOut(auth);
  ppAlert('Signed out.');
};
