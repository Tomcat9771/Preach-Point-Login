// server.js
// server.js

// ─── Imports ───────────────────────────────────────────────────────────────────
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Firebase Admin (modular)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config();

// ─── App setup (create app ONCE, before any app.use/routes) ────────────────────
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false })); // PayFast ITN needs this
app.use(express.static('public'));                // if you serve /public assets

// ─── Firebase Admin init (using base64 service account from env) ──────────────
const sa = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
);
if (getApps().length === 0) {
  initializeApp({ credential: cert(sa) });
}
const auth = getAuth();
const db = getFirestore();

// ─── Auth helpers ──────────────────────────────────────────────────────────────
async function authOptional(req, _res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (token) {
      const decoded = await auth.verifyIdToken(token);
      req.user = decoded; // custom claims (e.g. subscriber)
    }
  } catch {
    // ignore; unauthenticated requests just won't have req.user
  }
  next();
}
function requireAuth(req, res, next) {
  if (!req.user?.uid) return res.status(401).json({ error: 'Sign in required' });
  next();
}
function requireSubscriber(req, res, next) {
  if (!req.user?.subscriber) return res.status(402).json({ error: 'Subscription required' });
  next();
}
app.use(authOptional);

// Optional debug route
app.get('/api/me', requireAuth, (req, res) => {
  const { uid, email, subscriber } = req.user || {};
  res.json({ uid, email, subscriber: !!subscriber });
});

// ── Your other routes continue below…


// ── (Your other routes continue below) ───────────────────────────────────────
// e.g. app.post('/api/commentary', requireAuth, requireSubscriber, async (req,res)=>{...})
//*******************************************************************************************
// ---- DEBUG: show masked PayFast/Firebase envs (no secrets) ----
app.get('/api/debug/env', (_req, res) => {
  const mask = v => (v ? (v.length > 6 ? v.slice(0,3) + '...' + v.slice(-3) : '***') : '(empty)');
  res.json({
    PAYFAST_MODE: process.env.PAYFAST_MODE || '(unset)',
    PAYFAST_MERCHANT_ID: process.env.PAYFAST_MERCHANT_ID || '(unset)',
    PAYFAST_MERCHANT_KEY: mask(process.env.PAYFAST_MERCHANT_KEY),
    PAYFAST_PASSPHRASE: process.env.PAYFAST_PASSPHRASE ? '(set)' : '(empty)',
    PAYFAST_RETURN_URL: process.env.PAYFAST_RETURN_URL || '(unset)',
    PAYFAST_CANCEL_URL: process.env.PAYFAST_CANCEL_URL || '(unset)',
    PAYFAST_NOTIFY_URL: process.env.PAYFAST_NOTIFY_URL || '(unset)',
    SUBSCRIPTION_ITEM: process.env.SUBSCRIPTION_ITEM || '(unset)',
    SUBSCRIPTION_AMOUNT: process.env.SUBSCRIPTION_AMOUNT || '(unset)',
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || '(unset)',
    SERVICE_ACCOUNT_BASE64_PRESENT: !!process.env.FIREBASE_SERVICE_ACCOUNT_BASE64
  });
});

app.get('/api/debug/subscribe-dry-run', (req, res) => {
  try {
    const isLive = process.env.PAYFAST_MODE === 'live';
    const target = isLive
      ? 'https://www.payfast.co.za/eng/process'
      : 'https://sandbox.payfast.co.za/eng/process';

    const tidy  = (x) => (x == null ? '' : String(x).trim());
    const price = Number(process.env.SUBSCRIPTION_AMOUNT || 0).toFixed(2);
    const mPaymentId = 'debug_' + Math.random().toString(36).slice(2, 10);

    const fields = {
      merchant_id:   tidy(process.env.PAYFAST_MERCHANT_ID),
      merchant_key:  tidy(process.env.PAYFAST_MERCHANT_KEY),
      return_url:    tidy(process.env.PAYFAST_RETURN_URL),
      cancel_url:    tidy(process.env.PAYFAST_CANCEL_URL),
      notify_url:    tidy(process.env.PAYFAST_NOTIFY_URL),

      m_payment_id:  mPaymentId,
      amount:        price,
      item_name:     tidy(process.env.SUBSCRIPTION_ITEM),

      subscription_type: 1,
      recurring_amount:  price,
      frequency: 3,
      cycles: 0,

      custom_str1: 'debug-uid'
    };

    const paramStr  = buildPfParamString(fields, isLive ? process.env.PAYFAST_PASSPHRASE : null);
    const signature = md5Hex(paramStr);

    return res.json({
      target, fields, signature,
      note: 'This is a dry run. No Firestore writes, no redirect.'
    });
  } catch (e) {
    console.error('dry-run error:', e);
    return res.status(500).json({ error: String(e) });
  }
});

//----------------------------------------------------------------------------------

// RFC 3986 (rawurlencode) — spaces -> %20
function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}
//***********************************************************************************
// Official-ish field order used by PayFast when constructing the hash
const PF_FIELD_ORDER = [
  // Merchant Details
  "merchant_id",
  "merchant_key",
  "return_url",
  "cancel_url",
  "notify_url",
  // Buyer Detail (optional)
  "name_first",
  "name_last",
  "email_address",
  "cell_number",
  // Transaction Details
  "m_payment_id",
  "amount",
  "item_name",
  "item_description",
  "custom_int1",
  "custom_int2",
  "custom_int3",
  "custom_int4",
  "custom_int5",
  "custom_str1",
  "custom_str2",
  "custom_str3",
  "custom_str4",
  "custom_str5",
  // Transaction Options (optional)
  "email_confirmation",
  "confirmation_address",
  // Set Payment Method (optional)
  "payment_method",
  // Recurring Billing Details
  "subscription_type",
  "billing_date",
  "recurring_amount",
  "frequency",
  "cycles",
];

// RFC 3986 (rawurlencode) — spaces -> %20
function encodeRFC3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c =>
    '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

// Build param string in PayFast’s order; trim values; skip empties.
// Append passphrase ONLY in LIVE.
function buildPfParamString(fields, passphrase) {
  const tidy = v => (v == null ? '' : String(v).trim());
  const parts = [];

  // 1) Known fields in required order
  for (const key of PF_FIELD_ORDER) {
    const val = tidy(fields[key]);
    if (val !== '') parts.push(`${key}=${encodeRFC3986(val)}`);
  }

  // 2) Any extra fields (if any) in alphabetical order
  const known = new Set(PF_FIELD_ORDER);
  const extras = Object.keys(fields).filter(k => !known.has(k)).sort();
  for (const k of extras) {
    const val = tidy(fields[k]);
    if (val !== '') parts.push(`${k}=${encodeRFC3986(val)}`);
  }

  // 3) Passphrase (LIVE only)
  if (passphrase && String(passphrase).trim()) {
    parts.push(`passphrase=${encodeRFC3986(String(passphrase).trim())}`);
  }
  return parts.join('&');
}
//*********************************************************************************
function md5Hex(s) {
  return crypto.createHash('md5').update(s, 'utf8').digest('hex');
}
//--------------------------------------------------------------------------------

// ─── 2️⃣ Load kjv.json once at startup ──────────────────────────────────────────
let kjvData = [];
try {
  const filePath = path.join(process.cwd(), 'data', 'kjv.json');
  const raw      = await fs.readFile(filePath, 'utf8');
  const parsed   = JSON.parse(raw);
  kjvData = parsed.books;
  console.log(`✅ Loaded ${kjvData.length} books from data/kjv.json`);
} catch (err) {
  console.error('❌ Failed to load data/kjv.json:', err);
  // We don’t exit here—your routes will return JSON errors if kjvData is empty
}

// ─── 2.1️⃣ Load afri.json once at startup ──────────────────────────────────────────
let afriData = [];
try {
  const afriPath = path.join(process.cwd(), 'public', 'afri.json');
  const raw = await fs.readFile(afriPath, 'utf8');
  const parsed = JSON.parse(raw);
  afriData = parsed.verses;
  console.log(`✅ Loaded ${afriData.length} Afrikaans verses from public/afri.json`);
} catch (err) {
  console.error('❌ Failed to load public/afri.json:', err);
}
// Global Afrikaans book name map
const afBookNames = {
  'Genesis': 'Genesis',
  'Exodus': 'Eksodus',
  'Leviticus': 'Levitikus',
  'Numbers': 'Numeri',
  'Deuteronomy': 'Deuteronomium',
  'Joshua': 'Josua',
  'Judges': 'Rigters',
  'Ruth': 'Rut',
  '1 Samuel': '1 Samuel',
  'I Samuel': '1 Samuel',
  '2 Samuel': '2 Samuel',
  'II Samuel': '2 Samuel',
  '1 Kings': '1 Konings',
  'I Kings': '1 Konings',
  '2 Kings': '2 Konings',
  'II Kings': '2 Konings',
  '1 Chronicles': '1 Kronieke',
  'I Chronicles': '1 Kronieke',
  '2 Chronicles': '2 Kronieke',
  'II Chronicles': '2 Kronieke',
  'Ezra': 'Esra',
  'Nehemiah': 'Nehemia',
  'Esther': 'Ester',
  'Job': 'Job',
  'Psalms': 'Psalms',
  'Proverbs': 'Spreuke van Salomo',
  'Ecclesiastes': 'Prediker',
  'Song of Solomon': 'Hooglied van Salomo',
  'Isaiah': 'Jesaja',
  'Jeremiah': 'Jeremia',
  'Lamentations': 'Klaagliedere van Jeremia',
  'Ezekiel': 'Esegiël',
  'Daniel': 'Daniël',
  'Hosea': 'Hosea',
  'Joel': 'Joël',
  'Amos': 'Amos',
  'Obadiah': 'Obadja',
  'Jonah': 'Jona',
  'Micah': 'Miga',
  'Nahum': 'Nahum',
  'Habakkuk': 'Habakuk',
  'Zephaniah': 'Sefanja',
  'Haggai': 'Haggai',
  'Zechariah': 'Sagaria',
  'Malachi': 'Maleagi',
  'Matthew': 'Matteus',
  'Mark': 'Markus',
  'Luke': 'Lukas',
  'John': 'Johannes',
  'Acts': 'Die handelinge van die apostels',
  'Romans': 'Romeine',
  '1 Corinthians': '1 Korintiërs',
  'I Corinthians': '1 Korintiërs',
  '2 Corinthians': '2 Korintiërs',
  'II Corinthians': '2 Korintiërs',
  'Galatians': 'Galasiërs',
  'Ephesians': 'Effesiërs',
  'Philippians': 'Filippense',
  'Colossians': 'Kolossense',
  '1 Thessalonians': '1 Tessalonisense',
  'I Thessalonians': '1 Tessalonisense',
  '2 Thessalonians': '2 Tessalonisense',
  'II Thessalonians': '2 Tessalonisense',
  '1 Timothy': '1 Timoteus',
  'I Timothy': '1 Timoteus',
  '2 Timothy': '2 Timoteus',
  'II Timothy': '2 Timoteus',
  'Titus': 'Titus',
  'Philemon': 'Filemon',
  'Hebrews': 'Hebreërs',
  'James': 'Jakobus',
  '1 Peter': '1 Petrus',
  'I Peter': '1 Petrus',
  '2 Peter': '2 Petrus',
  'II Peter': '2 Petrus',
  '1 John': '1 Johannes',
  'I John': '1 Johannes',
  '2 John': '2 Johannes',
  'II John': '2 Johannes',
  '3 John': '3 Johannes',
  'III John': '3 Johannes',
  'Jude': 'Judas',
  'Revelation of John': 'Die openbaring',
'Revelation': 'Die openbaring',
};

// ─── 3️⃣ OpenAI client & in-memory cache ────────────────────────────────────────
const key = process.env.OPENAI_KEY ?? process.env.OPENAI_API_KEY;
if (!key) {
  console.error('Missing OpenAI key! Please set OPENAI_KEY in your env.');
  process.exit(1);
}
const openai = new OpenAI({ apiKey: key });
const cache  = new NodeCache({ stdTTL: 86400 }); // cache responses for 24h

// ✅ Proofread helper
async function proofreadText(text, lang = 'af') {
  if (lang !== 'af') return text; // only proof Afrikaans for now

  const proofPrompt = `Please proofread the following text. Ensure it is 100% in Afrikaans — no English words or phrases. Fix grammar, spelling, and tone as needed. Return only the corrected Afrikaans text:\n\n${text}`;

  const result = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'You are a professional Afrikaans language editor. You only reply in corrected Afrikaans. Do not explain or summarize anything.' },
      { role: 'user', content: proofPrompt }
    ],
    temperature: 0.5,
    max_tokens: 1000
  });

  return result.choices[0].message.content.trim();
}

// 4️⃣ Helper: extract verses across chapters
function extractVerses(bookName, startChap, startV, endChap, endV) {
  const bookObj = kjvData.find(b => b.name === bookName);
  if (!bookObj) throw new Error(`Book "${bookName}" not found`);

  const sC = Number(startChap), eC = Number(endChap);
  const sV = Number(startV), eV = Number(endV);
  const lines = [];

  for (let chap = sC; chap <= eC; chap++) {
    const chapObj = bookObj.chapters.find(c => c.chapter === chap);
    if (!chapObj) throw new Error(`Chapter "${chap}" not found in ${bookName}`);

    const verses = chapObj.verses.filter(v => {
      if (sC === eC) {
        return v.verse >= sV && v.verse <= eV;
      } else if (chap === sC) {
        return v.verse >= sV;
      } else if (chap === eC) {
        return v.verse <= eV;
      } else {
        return true;
      }
    });

    verses.forEach(v => lines.push(`${chap}:${v.verse} ${v.text}`));
  }

  if (lines.length === 0) {
    throw new Error(`No verses found in range ${startChap}:${startV}–${endChap}:${endV}`);
  }

  return lines.join('\n');
}
const availableBooks = [...new Set(afriData.map(v => v.book_name.trim()))];
console.log('Books in afriData:', availableBooks.sort());

function extractVersesAF(bookName, startChap, startV, endChap, endV) {
  const sC = Number(startChap), eC = Number(endChap);
  const sV = Number(startV), eV = Number(endV);

  
  const normalizedBook = afBookNames[bookName] || bookName;

  const verses = afriData.filter(v => {
    const chap = v.chapter;
    const verse = v.verse;
    if (v.book_name.trim() !== normalizedBook) return false;

    if (sC === eC) {
      return chap === sC && verse >= sV && verse <= eV;
    } else if (chap === sC) {
      return verse >= sV;
    } else if (chap === eC) {
      return verse <= eV;
    } else {
      return chap > sC && chap < eC;
    }
  });

  if (!verses.length) {
    throw new Error(`No Afrikaans verses found in ${bookName} ${startChap}:${startV}–${endChap}:${endV}`);
  }

  return verses.map(v => `${v.chapter}:${v.verse} ${v.text}`).join('\n');
}

//-------------------------------------------------------------------------------

app.post('/api/payfast/subscribe', requireAuth, async (req, res) => {
  try {
    if (!db) return res.status(500).json({ error: 'Server auth not initialized' });

    const isLive = process.env.PAYFAST_MODE === 'live';

    // Env checks — require passphrase ONLY in LIVE
    const required = [
      'PAYFAST_MODE','PAYFAST_MERCHANT_ID','PAYFAST_MERCHANT_KEY',
      'PAYFAST_RETURN_URL','PAYFAST_CANCEL_URL','PAYFAST_NOTIFY_URL',
      'SUBSCRIPTION_AMOUNT','SUBSCRIPTION_ITEM'
    ];
    if (isLive) required.push('PAYFAST_PASSPHRASE');

    const missing = required.filter(k => !process.env[k]);
    if (missing.length) {
      console.error('Missing PayFast env:', missing);
      return res.status(400).json({ error: 'Missing required PayFast environment variables', missing });
    }

    const target = isLive
      ? 'https://www.payfast.co.za/eng/process'
      : 'https://sandbox.payfast.co.za/eng/process';

    const tidy  = x => (x == null ? '' : String(x).trim());
    const price = Number(process.env.SUBSCRIPTION_AMOUNT || 0).toFixed(2);

    // Create Firestore doc and use its ID for m_payment_id
    const subRef = db.collection('subscriptions').doc();
    const mPaymentId = subRef.id;

    const fields = {
      merchant_id:   tidy(process.env.PAYFAST_MERCHANT_ID),
      merchant_key:  tidy(process.env.PAYFAST_MERCHANT_KEY),
      return_url:    tidy(process.env.PAYFAST_RETURN_URL),
      cancel_url:    tidy(process.env.PAYFAST_CANCEL_URL),
      notify_url:    tidy(process.env.PAYFAST_NOTIFY_URL),

      m_payment_id:  mPaymentId,
      amount:        price,
      item_name:     tidy(process.env.SUBSCRIPTION_ITEM),

      // Recurring
      subscription_type: 1,
      recurring_amount:  price,
      frequency: 3,
      cycles: 0,

      // Link back to Firebase user
      custom_str1: req.user.uid
    };

    // SIGN: passphrase ONLY in LIVE (buildPfParamString must use form-style encoding with + for spaces)
    const paramStr  = buildPfParamString(fields, isLive ? process.env.PAYFAST_PASSPHRASE : null);
    const signature = md5Hex(paramStr);

    console.log('PF mode:', isLive ? 'LIVE' : 'SANDBOX');
    console.log('PF target:', target);
    console.log('PF sign paramStr:', paramStr);
    console.log('PF signature:', signature);

    await subRef.set({
      uid: req.user.uid,
      status: 'pending',
      plan: 'monthly',
      createdAt: FieldValue.serverTimestamp()
    });

    // HTML-escape values so the browser posts exactly what we signed
    const escapeHtmlAttr = (s) =>
      String(s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const inputs = Object.entries({ ...fields, signature })
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtmlAttr(String(v))}" />`)
      .join('');

    // (Optional) one-time debug to compare what we post vs what we signed
    console.log('PF form inputs posted:', Object.fromEntries(Object.entries({ ...fields, signature }).map(([k,v]) => [k, String(v)])));

    return res
      .set('Content-Type','text/html')
      .send(`<!doctype html>
<html><body onload="document.forms[0].submit()">
  <form action="${target}" method="post">
    ${inputs}
  </form>
  <p>Redirecting to PayFast…</p>
</body></html>`);
  } catch (err) {
    console.error('subscribe error:', err);
    return res.status(500).json({ error: 'Could not start subscription' });
  }
});

//------------------------------------------------------------------------------
async function validateWithPayFast(paramStrNoPassphrase) {
  const isLive = process.env.PAYFAST_MODE === 'live';
  const url = isLive
    ? 'https://www.payfast.co.za/eng/query/validate'
    : 'https://sandbox.payfast.co.za/eng/query/validate';

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: paramStrNoPassphrase
  });
  const text = (await resp.text()).trim();
  return text; // 'VALID' or 'INVALID'
}

app.post('/api/payfast/itn', async (req, res) => {
  try {
    // ITN posts are x-www-form-urlencoded; we enabled urlencoded parser in Step 2
    const payload = { ...req.body };

    // 1) Check signature
    const receivedSig = payload.signature;
    delete payload.signature;

    const paramStrForHash = buildPfParamString(payload, process.env.PAYFAST_PASSPHRASE);
    const calcSig = md5Hex(paramStrForHash);
    if (calcSig !== receivedSig) {
      console.warn('ITN invalid signature');
      return res.status(200).send('OK'); // still 200 so PayFast doesn’t retry forever
    }

    // 2) Validate with PayFast (anti-spoof)
    // NOTE: For /eng/query/validate you do NOT include your passphrase
    const paramStrNoPassphrase = buildPfParamString(payload, null);
    const validateResp = await validateWithPayFast(paramStrNoPassphrase);
    if (validateResp !== 'VALID') {
      console.warn('ITN validate != VALID:', validateResp);
      return res.status(200).send('OK');
    }

    // 3) Extract key fields
const uid = payload.custom_str1;
const mPaymentId = payload.m_payment_id;
const paymentStatus = payload.payment_status;
const subscriptionStatus = payload.subscription_status;

// 4) Update Firestore subscription doc — use the ID from the payload
const subRef = db.collection('subscriptions').doc(mPaymentId);
await subRef.set({
  uid,
  status: (subscriptionStatus || paymentStatus || 'unknown').toLowerCase(),
  lastItn: payload,
  updatedAt: FieldValue.serverTimestamp()
}, { merge: true });

    // 5) Flip custom claim
    if ((subscriptionStatus === 'ACTIVE') || (paymentStatus === 'COMPLETE')) {
      const user = await auth.getUser(uid);
      await auth.setCustomUserClaims(uid, { ...(user.customClaims || {}), subscriber: true });
    }
    if ((subscriptionStatus === 'CANCELLED') || (paymentStatus === 'CANCELLED')) {
      const user = await auth.getUser(uid);
      const cc = { ...(user.customClaims || {}) };
      delete cc.subscriber;
      await auth.setCustomUserClaims(uid, cc);
    }

    // 6) Always 200 OK
    return res.status(200).send('OK');
  } catch (err) {
    console.error('ITN handler error:', err);
    return res.status(200).send('OK'); // acknowledge to avoid retries; check logs
  }
});
//------------------------------------------------------------------------------
// ─── 5️⃣ GET /api/chapters ─────────────────────────────────────────────────────
app.get('/api/chapters', (req, res) => {
  try {
    const book = req.query.book;
    if (!book) {
      return res.status(400).json({ error: 'Missing book parameter' });
    }
    const bookObj = kjvData.find(b => b.name === book);
    if (!bookObj) {
      return res.status(404).json({ error: `Book not found: ${book}` });
    }
    return res.json({ chapters: bookObj.chapters.map(c => c.chapter) });
  } catch (err) {
    console.error('Error in GET /api/chapters:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// 5.5️⃣ GET /api/books
app.get('/api/books', (req, res) => {
  // send back exactly the names your JSON uses
  const names = kjvData.map(b => b.name);
  res.json({ books: names });
});


// 6️⃣ Endpoint: get verses count for a chapter
app.get('/api/versesCount', (req, res) => {
  const book = req.query.book;
  const chapter = Number(req.query.chapter);
  if (!book || !chapter) return res.status(400).json({ error: 'Missing book or chapter parameter' });
  const bookObj = kjvData.find(b => b.name === book);
  if (!bookObj) return res.status(400).json({ error: `Book ${book} not found` });
  const chapObj = bookObj.chapters.find(c => c.chapter === chapter);
  if (!chapObj) return res.status(400).json({ error: `Chapter ${chapter} not found in ${book}` });
  const verses = chapObj.verses.map(v => v.verse);
  res.json({ verses });
});

// 7️⃣ Endpoint: fetch bible text (single or multi-chapter)
app.post('/api/verses', (req, res) => {
  try {
    const { book, startChapter, startVerse, endChapter, endVerse } = req.body;
    if (!book || !startChapter || !startVerse) {
      return res.status(400).json({ error: 'Missing book, startChapter, or startVerse' });
    }
    const sCh = startChapter;
    const eCh = endChapter || startChapter;
    const sV  = startVerse;
    const eV  = endVerse || startVerse;

    const text = extractVerses(book, sCh, sV, eCh, eV);
    res.json({ text });
  } catch (err) {
    console.error('Error in /api/verses:', err);
    res.status(400).json({ error: err.message });
  }
});

// 8️⃣ Endpoint: translate into Afrikaans
app.post('/api/translate', async (req, res) => {
  try {
    const { book, startChapter, startVerse, endChapter, endVerse } = req.body;
    if (!book || !startChapter || !startVerse) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const scripture = extractVersesAF(
      book,
      startChapter,
      startVerse,
      endChapter || startChapter,
      endVerse || startVerse
    );

    // Normalize book name for display
    const afRefBook = afBookNames[book] || book;
    const passageRef = `${afRefBook} ${startChapter}:${startVerse}-${endChapter || startChapter}:${endVerse || startVerse}`;

    res.json({ translation: scripture, passageRef });
  } catch (err) {
    console.error('Error in /api/translate:', err);
    res.status(500).json({ error: err.message });
  }
});
// 9️⃣ Endpoint: AI-only commentary
app.post('/api/commentary', requireAuth, requireSubscriber, async (req, res) => {
  try {
    const { book, startChapter, startVerse, endChapter, endVerse, tone, level, lang } = req.body;
    if (!book || !startChapter || !startVerse) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const sCh = startChapter;
    const eCh = endChapter || startChapter;
    const sV  = startVerse;
    const eV  = endVerse || startVerse;

    const scripture = lang === 'af'
      ? extractVersesAF(book, sCh, sV, eCh, eV)
      : extractVerses(book, sCh, sV, eCh, eV);
    const langLabel  = lang === 'af' ? 'Afrikaans' : 'English';
    const afRefBook = afBookNames[book] || book;
const passageRef = `${afRefBook} ${startChapter}:${startVerse}-${endChapter || startChapter}:${endVerse || startVerse}`;

    const prompt = `Write a ${langLabel} commentary on this passage:\n\n${scripture}\n\nTone: ${tone}\nLevel: ${level}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are Preach Point AI, an expert Bible commentary assistant. Only return commentary. Do not return prayers, introductions, or scripture text.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2500
    });

    let commentary = completion.choices[0].message.content.trim();
    commentary = await proofreadText(commentary, lang);
    res.json({ commentary });
  } catch (err) {
    console.error('Error in /api/commentary:', err);
    res.status(500).json({ error: err.message });
  }
});
// 9.5️⃣ Endpoint: AI-only devotion
app.post('/api/devotion', requireAuth, requireSubscriber, async (req, res) => {
  try {
    const { book, startChapter, startVerse, endChapter, endVerse, lang } = req.body;
    if (!book || !startChapter || !startVerse) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const sCh = startChapter;
    const eCh = endChapter || startChapter;
    const sV  = startVerse;
    const eV  = endVerse || startVerse;

    const scripture = lang === 'af'
      ? extractVersesAF(book, sCh, sV, eCh, eV)
      : extractVerses(book, sCh, sV, eCh, eV);
    const langLabel = lang === 'af' ? 'Afrikaans' : 'English';

    const prompt = `Write a pastoral devotion in ${langLabel} based on the passage below. 
- 3–5 concise paragraphs, warm and practical.
- Faithful to the text; no speculative or controversial claims.
- No headings or verse references in the body.
- Include one clear application and one brief closing line of encouragement.
Return only the devotion text.

Passage:
${scripture}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are Preach Point AI. You write concise, pastoral devotions that are Biblically faithful and application-focused. Do not include headings, verse references, or introductions. Return only the devotion text.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.4,
      max_tokens: 1000
    });

    let devotion = (completion.choices?.[0]?.message?.content || '').trim();
    if (lang === 'af' && devotion) {
      devotion = await proofreadText(devotion, 'af');
    }
    res.json({ devotion });
  } catch (err) {
    console.error('Error in /api/devotion:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});


// 🔟 Endpoint: AI-only prayer
app.post('/api/prayer', requireAuth, requireSubscriber, async (req, res) => {
  try {
    const { book, startChapter, startVerse, endChapter, endVerse, lang } = req.body;
    if (!book || !startChapter || !startVerse) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const scripture = extractVerses(
      book,
      startChapter,
      startVerse,
      endChapter || startChapter,
      endVerse   || startVerse
    );
    const langLabel = lang === 'af' ? 'Afrikaans' : 'English';

    const prompt = `Write a prayer in ${langLabel} based on the following scripture.\n\nRespond ONLY in ${langLabel}.\n\nScripture:\n${scripture}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: 'You are Preach Point AI, a spiritual assistant. ONLY return the body of a prayer. DO NOT include phrases like "Here is a prayer", "Inspired by the verses", "Prayer:", or any introductory lines. Only return the prayer content. No headings. No scripture. No reference. Just the prayer itself.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    });

    let prayerText = completion.choices[0].message.content.trim();
    prayerText = prayerText
      .split('\n')
      .filter(line => !/^Here is.*prayer/i.test(line) && !/^Hier is.*gebed/i.test(line))
      .join('\n')
      .trim();

    prayerText = await proofreadText(prayerText, lang);
    res.json({ prayer: prayerText });
  } catch (err) {
    console.error('Error in /api/prayer:', err);
    res.status(500).json({ error: err.message });
  }
});



// ─── Global error handler ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── 🔟 Launch server ───────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Preach Point server listening on http://localhost:${PORT}`);
});