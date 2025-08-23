// /public/login.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut
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
window.__auth = auth; // let other scripts use token if needed

// ===== helpers =====
function setText(id, t){ const el=document.getElementById(id); if (el) el.textContent=t; }
function apiBase(){
  // For WordPress embedding, swap to your deployed origin:
  // return 'https://preach-point-login.vercel.app';
  return ''; // same-origin while running locally
}
async function authFetch(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (auth.currentUser) {
    const t = await auth.currentUser.getIdToken(true);
    headers.Authorization = `Bearer ${t}`;
  }
  return fetch(apiBase()+url, { ...opts, headers });
}
async function authFetchJson(url, opts = {}) {
  const res = await authFetch(url, { ...opts, headers:{ ...(opts.headers||{}), 'Content-Type':'application/json' } });
  const txt = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

// ===== UI refs =====
const msg     = document.getElementById('msg');
const emailEl = document.getElementById('email');
const passEl  = document.getElementById('pass');
const meBox   = document.getElementById('meBox');

const gateCard    = document.getElementById('gate');
const gateStatus  = document.getElementById('gateStatus');
const enterAppBtn = document.getElementById('enterAppBtn');
const subscribeBtn= document.getElementById('subscribeBtn');

// ===== gate helpers =====
function showGate({ show, status, canEnter, canSubscribe }){
  gateCard.style.display = show ? 'block' : 'none';
  gateStatus.textContent = status || '';
  enterAppBtn.style.display = canEnter ? 'inline-block' : 'none';
  subscribeBtn.style.display = canSubscribe ? 'inline-block' : 'none';
}
async function refreshGate(){
  const user = auth.currentUser;
  if (!user){
    showGate({ show:true, status:'Please sign in to continue.', canEnter:false, canSubscribe:false });
    return;
  }
  try{
    const me = await authFetchJson('/api/me');
    if (me?.subscriber){
      showGate({ show:true, status:'Subscription active ✅', canEnter:true, canSubscribe:false });
    }else{
      showGate({ show:true, status:'Subscription required ❗', canEnter:false, canSubscribe:true });
    }
    meBox.textContent = JSON.stringify(me, null, 2);
  }catch(e){
    showGate({ show:true, status:'Could not verify subscription.', canEnter:false, canSubscribe:false });
    meBox.textContent = String(e);
  }
}

// ===== auth state =====
onAuthStateChanged(auth, async (user) => {
  if (user) {
    setText('msg', `Signed in as ${user.email}`);
    await refreshGate();
  } else {
    setText('msg', 'Not signed in.');
    showGate({ show:true, status:'Please sign in to continue.', canEnter:false, canSubscribe:false });
  }
});

// ===== buttons =====
document.getElementById('btnSignup').onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, emailEl.value, passEl.value);
    alert('Account created & signed in.');
  } catch (e) { alert(e.message || e); }
};
document.getElementById('btnSignin').onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, emailEl.value, passEl.value);
  } catch (e) { alert(e.message || e); }
};
document.getElementById('btnSignout').onclick = async () => {
  await signOut(auth);
  alert('Signed out.');
};
document.getElementById('btnMe').onclick = async () => {
  try { meBox.textContent = JSON.stringify(await authFetchJson('/api/me'), null, 2); }
  catch (e) { meBox.textContent = String(e); }
};

enterAppBtn.onclick = () => { location.href = '/index.html'; };

subscribeBtn.onclick = async () => {
  try {
    const res = await authFetch('/api/payfast/subscribe', { method:'POST' });
    const html = await res.text();
    const w = window.open('', '_blank');
    if (!w) return alert('Please allow popups for this site.');
    w.document.open(); w.document.write(html); w.document.close(); // autosubmit
  } catch (e) {
    alert(e.message || e);
  }
};
