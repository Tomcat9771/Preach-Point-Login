// ─── safeFetchJson helper ─────────────────────────────────────
/**
 * Fetches URL and returns parsed JSON, or throws with the raw text on error.
 */
async function safeFetchJson(url) {
  const res = await fetch(url);
  const txt = await res.text();
  if (!res.ok) {
    console.error('API error response:', txt);
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return JSON.parse(txt);
}

// ─── Localized Afrikaans book names (same order as /api/books) ──
const afBookNames = [
  "Genesis","Eksodus","Levitikus","Numeri","Deuteronomium","Josua",
  "Rigters","Rut","1 Samuel","2 Samuel","1 Konings","2 Konings",
  "1 Kronieke","2 Kronieke","Esra","Nehemia","Esther","Job","Psalms",
  "Spreuke","Prediker","Hooglied","Jesaja","Jeremia","Klaagliedere",
  "Esegiel","Daniël","Hosëa","Joël","Amos","Obadja","Jona","Miga",
  "Nahum","Habakkuk","Sefanja","Haggai","Sagaria","Maleagi",
  "Matteus","Markus","Lukas","Johannes","Handelinge","Romeine",
  "1 Korintiërs","2 Korintiërs","Galasiërs","Efe­siërs","Filippense",
  "Kolossense","1 Tessalonisense","2 Tessalonisense","1 Timoteus",
  "2 Timoteus","Titus","Filemon","Hebreërs","Jakobus","1 Petrus",
  "2 Petrus","1 Johannes","2 Johannes","3 Johannes","Judas","Openbaring"
];

// ─── Standard UI label data ─────────────────────────────────────
const toneOptions  = { en: ["Teaching","Encouragement","Evangelism"], af: ["Onderrig","Aanmoediging","Evangelies"] };
const levelOptions = { en: ["Short","Sermon-Style","Full Commentary"], af: ["Kort","Preek-Styl","Volledige Kommentaar"] };
const labels = {
  en: { lang:"Language", book:"Book", chapter:"Start Chapter", verse:"Start Verse", endChapter:"End Chapter", endVerse:"End Verse", tone:"Tone", level:"Explanation Level" },
  af: { lang:"Taal",    book:"Boek", chapter:"Begin Hoofstuk", verse:"Begin Vers",      endChapter:"Eind Hoofstuk",   endVerse:"Eind Vers",       tone:"Toon",  level:"Uitlegvlak" }
};
const buttonLabels = {
  en: {
    generate: "Generate Commentary",
    copy:     "Copy to Clipboard",
    reset:    "Reset Fields",
    pdf:      "Download as PDF"
  },
  af: {
    generate: "Genereer Kommentaar",
    copy:     "Kopieer na klembord",
    reset:    "Herstel Velde",
    pdf:      "Laai af as PDF"
  }
 };
const headingLabels = {
  en: { verses: "Bible Text", commentary: "Commentary", prayer: "Prayer" },
  af: { verses: "Bybelteks", commentary: "Kommentaar", prayer: "Gebed" }
};

// shorthand for document.getElementById
function $(id) { return document.getElementById(id); }

// ─── Populate the book <select> from /api/books ─────────────────
async function populateBooks() {
  const loc = $('lang').value;
  let data;
  try {
    data = await safeFetchJson('/api/books');
  } catch (err) {
    console.error('Could not load books list:', err);
    return;
  }
  const bookSelect = $('book');
  bookSelect.innerHTML = '';
  // localized placeholder:
  const placeholder = loc === 'af'
    ? '---Kies n boek---'
    : '— Select a Book —';
  bookSelect.append(new Option(placeholder, ''));
    if ($('lang').value === 'af') {
    // show Afrikaans names, but keep the value = English key
    data.books.forEach((engName, i) => {
      bookSelect.append(new Option(afBookNames[i], engName));
    });
  } else {
    data.books.forEach(name => {
      bookSelect.append(new Option(name, name));
    });
  }
}

// ─── Populate chapters after a book is chosen ───────────────────
async function populateChapters() {
  const loc      = $('lang').value;
  const bookName = $('book').value;
  const sel0     = $('chapter');
  const sel1     = $('end-chapter');

  sel0.innerHTML = '';
  sel1.innerHTML = '';
  sel0.append(new Option(labels[loc].chapter,''));
  sel1.append(new Option(labels[loc].endChapter,''));

  if (!bookName) return;

  let js;
  try {
    js = await safeFetchJson(`/api/chapters?book=${encodeURIComponent(bookName)}`);
  } catch (err) {
    alert(`Could not load chapters: ${err.message}`);
    return;
  }

  js.chapters.forEach(num => {
    sel0.append(new Option(num, num));
    sel1.append(new Option(num, num));
  });
}

// ─── Populate verses after a chapter is chosen ──────────────────
async function populateVerses() {
  const loc      = $('lang').value;
  const bookName = $('book').value;
  const chap     = $('chapter').value;
  const sel0     = $('verse');
  const sel1     = $('end-verse');

  sel0.innerHTML = '';
  sel1.innerHTML = '';
  sel0.append(new Option(labels[loc].verse,''));
  sel1.append(new Option(labels[loc].endVerse,''));

  if (!bookName || !chap) return;

  let js;
  try {
    js = await safeFetchJson(
      `/api/versesCount?book=${encodeURIComponent(bookName)}&chapter=${chap}`
    );
  } catch (err) {
    alert(`Could not load verses: ${err.message}`);
    return;
  }

  js.verses.forEach(num => {
    sel0.append(new Option(num, num));
    sel1.append(new Option(num, num));
  });
}

// ─── Populate tone & level selects ──────────────────────────────
function populateTone() {
  const loc = $('lang').value;
  const sel = $('tone');
  sel.innerHTML = '';
  toneOptions[loc].forEach(o => sel.append(new Option(o, o.toLowerCase())));
}
function populateLevels() {
  const loc = $('lang').value;
  const sel = $('level');
  sel.innerHTML = '';
  levelOptions[loc].forEach(o =>
    sel.append(new Option(o, o.toLowerCase().replace(/\s+/g,'-')))
  );
}
/**
 * Syncs button text and section headings to the selected language.
 */
function updateButtonsAndHeadings(loc) {
  // buttonLabels and headingLabels are your globals defined earlier
  $('generate-btn').textContent      = buttonLabels[loc].generate;
  $('copy-btn').textContent          = buttonLabels[loc].copy;
  $('reset-btn').textContent         = buttonLabels[loc].reset;
  $('download-pdf').textContent      = buttonLabels[loc].pdf;
  $('verses-heading').textContent     = headingLabels[loc].verses;
  $('commentary-heading').textContent = headingLabels[loc].commentary;
  $('prayer-heading').textContent = headingLabels[loc].prayer;
}

// ─── Update all labels, then repopulate dropdowns ───────────────
function updateUI() {
  const loc = $('lang').value;
  const L   = labels[loc];
  $('lang-label').textContent        = L.lang;
  $('book-label').textContent        = L.book;
  $('chapter-label').textContent     = L.chapter;
  $('verse-label').textContent       = L.verse;
  $('end-chapter-label').textContent = L.endChapter;
  $('end-verse-label').textContent   = L.endVerse;
  $('tone-label').textContent        = L.tone;
  $('level-label').textContent       = L.level;
  updateButtonsAndHeadings(loc);

  populateBooks();
  populateChapters();
  populateVerses();
  populateTone();
  populateLevels();
}
function onReset() {
  // 1) Clear all selects/dropdowns
  ['book','chapter','end-chapter','verse','end-verse'].forEach(id => {
    $(id).value = '';
  });

  // 2) Clear the displayed text
  $('verses').textContent     = '';
  $('commentary').textContent = '';
  $('prayer').textContent     = '';
  $('prayer').textContent     = '';

  // 3) (Optional) Repopulate tone & level to defaults for current language
  populateTone();
  populateLevels();

  // 4) Refresh labels/buttons
  updateUI();
}

// ─── Wire up event listeners ─────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  updateUI();
  $('lang').addEventListener('change', updateUI);
  $('book').addEventListener('change', populateChapters);
  $('chapter').addEventListener('change', populateVerses);
  $('generate-btn').addEventListener('click', onGenerate);
  $('copy-btn').addEventListener('click', onCopy);
  $('reset-btn').addEventListener('click', onReset);
  $('download-pdf').addEventListener('click', onDownloadPDF);
});

// ─── Generate & display commentary ───────────────────────────────
async function onGenerate() {
  const lang     = $('lang').value;
  const bookName = $('book').value;
  const sCh      = $('chapter').value;
  const sV       = $('verse').value;
  const eCh      = $('end-chapter').value || sCh;
  const eV       = $('end-verse').value   || sV;
  const tone     = $('tone').value;
  const lvl      = $('level').value;

  if (!bookName || !sCh || !sV) {
    alert('Please select a book, chapter & verse.');
    return;
  }

  // ① Show spinners
  $('verses').innerHTML     = '<div class="spinner spinner--dual-ring"></div>';
  $('commentary').innerHTML = '<div class="spinner spinner--dual-ring"></div>';
  $('prayer').innerHTML     = '<div class="spinner spinner--dual-ring"></div>';

  // ② Fetch & render verses (or translation)
  try {
    const url     = lang === 'af' ? '/api/translate' : '/api/verses';
    const payload = { book: bookName, startChapter: sCh, startVerse: sV, endChapter: eCh, endVerse: eV };
    const res     = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const js      = await res.json();
    if (!res.ok) throw new Error(js.error || 'Fetch error');
    const ref = `${bookName} ${sCh}:${sV}–${eCh}:${eV}`;
const verseBlock = (lang === 'af' ? js.translation : js.text);
$('verses').textContent = `${ref}\n\n${verseBlock}`;
  } catch (e) {
    $('verses').textContent = `Error: ${e.message}`;
    return;
  }

  // ③ Fetch & render AI commentary
  // keep showing the spinner until the commentary comes back
    try {
    const payload2 = { book: bookName, startChapter: sCh, startVerse: sV, endChapter: eCh, endVerse: eV, tone, level: lvl, lang };
    const res2     = await fetch('/api/commentary', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload2)
    });
    const js2      = await res2.json();
    if (!res2.ok) throw new Error(js2.error || 'Commentary error');
       let commentaryText = js2.commentary;
   // In Afrikaans, replace any leading "Conclusie" with "Slotopmerkings"
   if (lang === 'af') {
     commentaryText = commentaryText.replace(
       /^Conclusie\b/, 
       'Gevolgtrekking'
     );
   }
   $('commentary').textContent = commentaryText;
  } catch (e) {
    $('commentary').textContent = `Error: ${e.message}`;
  }

// ④ Fetch & render AI prayer
try {
  const res3 = await fetch('/api/prayer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ book: bookName, startChapter: sCh, startVerse: sV, endChapter: eCh, endVerse: eV, lang })
  });
  const js3 = await res3.json();
  if (!res3.ok) throw new Error(js3.error || 'Prayer error');

  // Localize the intro line:
  let prayerText = js3.prayer;
  
  $('prayer').textContent = prayerText;
} catch (e) {
  $('prayer').textContent = `Error: ${e.message}`;
}
}
// ─── Copy to clipboard helper ────────────────────────────────────
function onCopy() {
  const loc = $('lang').value;
  const text = 
    `${labels[loc].tone}: ${$('tone').value}\n` +
    `${labels[loc].level}: ${$('level').value}\n\n` +
    `${headingLabels[loc].verses}:\n${$('verses').textContent}\n\n` +
    `${headingLabels[loc].commentary}:\n${$('commentary').textContent}\n\n` +
    `${headingLabels[loc].prayer}:\n${$('prayer').textContent}`;
   navigator.clipboard.writeText(text)
     .then(() => alert('Copied!'))
     .catch(e => alert('Copy failed:'+e));
 }

// ─── Your existing onDownloadPDF (unchanged) ────────────────────


/**
 * Generate a clean, Acrobat-friendly PDF using only jsPDF core.
 */
async function onDownloadPDF() {
  // 1️⃣ Grab jsPDF
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.width;
  const pageH = doc.internal.pageSize.height;
  let cursorY = 40;

  // 2️⃣ Draw the logo (centered)
  const imgEl = document.getElementById('logo');
  if (imgEl) {
    // Draw it to a canvas so we can grab a DataURL
    const canvas = document.createElement('canvas');
    canvas.width  = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const imgProps = doc.getImageProperties(dataUrl);
    const imgW = 100;  // desired width
    const imgH = (imgProps.height * imgW) / imgProps.width;
    doc.addImage(dataUrl, 'PNG', (pageW - imgW)/2, cursorY, imgW, imgH);
    cursorY += imgH + 20;
  }

  // 3️⃣ Tone & Level line
  const loc = document.getElementById('lang').value;
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(`Tone: ${$('tone').value}`, 40, cursorY);
  doc.text(`Level: ${$('level').value}`, pageW - 40, cursorY, { align: 'right' });
  cursorY += 20;

  // 4️⃣ Verses section
  doc.setFont('helvetica', 'normal').setFontSize(11);
  doc.setTextColor(0,0,0);
  doc.text(headingLabels[loc].verses, pageW/2, cursorY, { align: 'center' });
  cursorY += 20;
  const verses = $('verses').textContent.split('\n');
  verses.forEach(line => {
    const lines = doc.splitTextToSize(line, pageW - 80);
    doc.text(lines, 40, cursorY);
    cursorY += lines.length * 14;
    if (cursorY > pageH - 40) {
      doc.addPage();
      cursorY = 40;
    }
  });
  cursorY += 20;

  // 5️⃣ Commentary section
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(headingLabels[loc].commentary, pageW/2, cursorY, { align: 'center' });
  cursorY += 20;
  doc.setFont('helvetica', 'normal').setFontSize(11);
  const comm = $('commentary').textContent.split('\n');
  comm.forEach(line => {
    const lines = doc.splitTextToSize(line, pageW - 80);
    doc.text(lines, 40, cursorY);
    cursorY += lines.length * 14;
    if (cursorY > pageH - 40) {
      doc.addPage();
      cursorY = 40;
    }
  });
  // 6️⃣ Prayer section
  cursorY += 20;
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(headingLabels[loc].prayer, pageW/2, cursorY, { align: 'center' });
  cursorY += 20;
  doc.setFont('helvetica', 'normal').setFontSize(11);
  const pray = $('prayer').textContent.split('\n');
  pray.forEach(line => {
    const lines = doc.splitTextToSize(line, pageW - 80);
    doc.text(lines, 40, cursorY);
    cursorY += lines.length * 14;
    if (cursorY > pageH - 40) {
      doc.addPage();
      cursorY = 40;
    }
  });


  // 6️⃣ Save
  doc.save('preachpoint_commentary.pdf');
}  // <-- closing brace for function
