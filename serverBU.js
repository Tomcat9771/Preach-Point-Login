// server.js

// ─── 0️⃣ Imports ─────────────────────────────────────────────────────────────────
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { OpenAI } from 'openai';
import NodeCache from 'node-cache';
import dotenv from 'dotenv';

dotenv.config();

// ─── 1️⃣ App setup ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static('public'));  // serve your front-end

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
app.post('/api/commentary', async (req, res) => {
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


// 🔟 Endpoint: AI-only prayer
app.post('/api/prayer', async (req, res) => {
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