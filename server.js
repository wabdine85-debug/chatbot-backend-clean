import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import os from "os";

// Nur lokal .env laden (nicht auf Render)
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

import pkg from "pg";
const { Pool } = pkg;

// Verbindung zu deiner Kundenkartei-Datenbank
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public"));

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";
const DEBUG = process.env.DEBUG === "true";

/* ------------------------- Utils ------------------------- */

const treatments = JSON.parse(
  fs.readFileSync(new URL("./treatments.json", import.meta.url), "utf8")
);

function matchTreatments(tags) {
  if (!Array.isArray(tags)) return [];
  if (!Array.isArray(treatments)) return [];



  const scored = treatments.map(t => {
    let score = 0;
    if (!t.wisy) return { ...t, score: 0 };

    tags.forEach(tag => {
      if (t.wisy.probleme?.includes(tag)) score += 3;
      if (t.wisy.ziele?.includes(tag)) score += 2;
      if (t.wisy.hauttypen?.includes(tag)) score += 1;
    });

    return { ...t, score };
  });

  return scored
    .filter(t => t.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function shouldDirectToBooking(matches) {
  if (matches.length !== 1) return false;
  const t = matches[0];
  return t.wisy?.buchung_moeglich === true;
}

function buildReply(matches) {
  if (!matches.length) {
    return `
      Ich möchte dir nichts Falsches empfehlen.<br><br>
      👉 <a href="${CONTACT_URL}">
      Kurze Beratung anfragen
      </a>
    `;
  }

  // ✅ EIN klares Match → DIREKT BUCHEN
  if (shouldDirectToBooking(matches)) {
    const t = matches[0];
    return `
      Basierend auf deiner Beschreibung kann <strong>${t.name}</strong> gut zu dir passen.<br><br>
      ${t.beschreibung}<br><br>
      💶 ${t.preis}<br><br>
      👉 <a href="${t.url}">
      Jetzt ${t.name} online buchen
      </a>
    `;
  }

  // ⚠️ Mehrere Matches → Auswahl
  let text = `Diese Behandlungen könnten zu dir passen:<br><br>`;

  matches.forEach(t => {
    text += `
      <strong>${t.name}</strong><br>
      ${t.beschreibung}<br>
      💶 ${t.preis}<br>
      👉 <a href="${t.url}">Zur Behandlungsseite</a><br><br>
    `;
  });

  return text;
}


function makeMarkdownLink(label, url) {
  return `[${label}](${url})`;
}

function normalize(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—−]/g, "-")
    .replace(/[^a-z0-9\-+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  return normalize(s).split(" ").filter(w => w.length > 1);
}

function levenshtein(a, b) {
  a = normalize(a);
  b = normalize(b);
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/* ---------- Treatments laden ---------- */
function loadTreatments() {
  try {
    const raw = JSON.parse(fs.readFileSync(new URL("./treatments.json", import.meta.url)));
    return raw.map(t => ({
      name: t.treatment || t.name || "",
      beschreibung: t.description || t.beschreibung || "",
      preis: t.preis || "",
      url: t.url || CONTACT_URL
    }));
  } catch (e) {
    console.error("⚠️ Fehler beim Laden von treatments.json:", e.message);
    return [];
  }
}

/* ---------- FAQ laden ---------- */
function loadFaq() {
  try {
    return JSON.parse(fs.readFileSync(new URL("./faq.json", import.meta.url)));
  } catch (e) {
    console.error("⚠️ Fehler beim Laden von faq.json:", e.message);
    return [];
  }
}

/* ---------- Matching & Intent ---------- */
function scoreMatch(query, item) {
  const nq = normalize(query);
  const nameNorm = normalize(item.name);
  let score = 0;

  if (nameNorm.includes(nq) || nq.includes(nameNorm)) score += 50;

  const overlap = tokenize(query).filter(q => nameNorm.includes(q)).length;
  score += overlap * 20;

  const dist = levenshtein(nq, nameNorm);
  if (dist <= 3) score += 30;

  return score;
}

function synonymFind(query, treatments) {
  const n = normalize(query);

  if (/\bhaare|haarentfernung|ruecken|rücken|bein|brust|arm|gesicht\b/.test(n)) {
    return treatments.find(t => /laser/i.test(t.name));
  }

  if (/\bakne|pickel|unreine haut|entzue|entzünd/i.test(n)) {
    return treatments.find(t => /akne|hydrafacial|peel|microneedling/i.test(t.name));
  }

  return null;
}

function smartFindTreatment(query, treatments) {
  if (!query) return null;

  const syn = synonymFind(query, treatments);
  if (syn) return syn;

  const candidates = treatments
    .map(t => ({ t, s: scoreMatch(query, t) }))
    .sort((a, b) => b.s - a.s);
  const best = candidates[0];
  return best && best.s >= 40 ? best.t : null;
}

function detectIntent(msg) {
  const n = normalize(msg);
  return {
    isPrice: /(preis|kosten|kostet|€|euro|teuer|angebot)/.test(n),
    isWhat: /(was ist|erklaer|erklär|wirkung|info|geeignet|empfehlung)/.test(n),
    isGreet: /\b(hi|hallo|hey|servus|moin|guten (tag|morgen|abend))\b/.test(n),
    isBooking: /(termin|buchen|buchung|verfuegbar|verfügbar|wann)/.test(n),
    isOpening: /(öffnungszeit|offnungszeit|geöffnet|geoeffnet|auf|bis wann|wann habt ihr)/.test(n)
  };
}

/* ------------------------- Routen ------------------------- */
app.get("/", (_req, res) => res.send("OK"));

app.get("/whoami", (_req, res) => {
  const path = new URL("./treatments.json", import.meta.url).pathname;
  let stats = { count: 0, names: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(new URL("./treatments.json", import.meta.url)));
    stats = { count: raw.length || 0, names: raw.slice(0, 3).map(x => x.treatment || x.name) };
  } catch {}
  res.json({
    service: "wisy-backend",
    pid: process.pid,
    host: os.hostname(),
    cwd: process.cwd(),
    treatmentsPath: path,
    treatmentsSample: stats,
    time: new Date().toISOString()
  });
});


/* ⛔️ ALTE CHAT-LOGIK – TEMPORÄR DEAKTIVIERT

/* ---------- /chat ---------- */
app.post("/chat_old", async (req, res) => {
  const userMessage = (req.body.message || "").toString().slice(0, 300);
  // 🔹 Tags aus Frontend (falls vorhanden)
const tags = Array.isArray(req.body.tags) ? req.body.tags : [];

// 🔹 Behandlungen (Basis-Logik)
const treatments = [
  {
    name: "Hydrafacial",
    probleme: ["unreine haut", "trockene haut", "mitesser", "fahle haut"],
    text: "Hydrafacial ist ideal bei unreiner und gleichzeitig trockener Haut, da die Behandlung tiefenreinigt und intensiv Feuchtigkeit spendet.",
    url: "https://palaisdebeaute.de/products/hydrafacial-md"
  },
  {
    name: "Microneedling",
    probleme: ["akne", "grosse poren", "feine linien"],
    text: "Microneedling unterstützt die Hauterneuerung, verfeinert Poren und verbessert das Hautbild nachhaltig.",
    url: "https://palaisdebeaute.de/products/microneedling"
  }
];

// 🔹 Bestes Matching ermitteln
let bestMatch = null;
let bestScore = 0;

for (const t of treatments) {
  const score = tags.filter(tag => t.probleme.includes(tag)).length;
  if (score > bestScore) {
    bestScore = score;
    bestMatch = t;
  }
}

// 🔹 Wenn Match gefunden → SOFORT antworten (kein OpenAI, kein Fallback)
if (bestMatch) {
  return res.json({
    reply: `
<strong>${bestMatch.name}</strong><br>
${bestMatch.text}<br><br>
<a href="${bestMatch.url}" class="chat-button">Jetzt Behandlung buchen</a>
`
  });
}

  const MAX_TOKENS = 200;

  try {
    const intent = detectIntent(userMessage);
    const nmsg = normalize(userMessage);

    // 👉 Begrüßung
    if (intent.isGreet) {
      return res.json({ reply: "Hallo! Wie kann ich Ihnen heute weiterhelfen?" });
    }

    // 👉 Öffnungszeiten
    if (intent.isOpening || /offen|geoeffnet|geöffnet|öffnungszeiten|wann/.test(nmsg)) {
      return res.json({
        reply: "Wir haben Montag, Dienstag, Donnerstag und Freitag 10:00–18:00 Uhr, Samstag von 10:00–15:00 Uhr geöffnet. Mittwoch geschlossen."
      });
    }

    // 👉 Adresse
    if (/adresse|wo seid ihr|standort|wo finde ich euch/.test(nmsg)) {
      return res.json({ reply: "PDB Aesthetic Room, Rheinstr. 59, 65185 Wiesbaden." });
    }

    // 👉 Parkplatz
    if (/park(en|platz)|auto|parken/.test(nmsg)) {
      return res.json({ reply: "Parkmöglichkeiten findest du direkt in der Rheinstraße sowie im Parkhaus Luisenforum." });
    }

    // 👉 Treatments
    const treatments = loadTreatments();
    const best = smartFindTreatment(userMessage, treatments);

    if (best) {
      const desc = (best.beschreibung || "")
        .split(/(?<=\.)\s+/)
        .slice(0, 4)
        .join(" ")
        .slice(0, 600);

      let reply = `${best.name}: ${desc}`;
      if (intent.isPrice && best.preis) reply += ` Preis: ${best.preis}.`;
      reply += ` Mehr Infos hier: [Behandlung ansehen](${best.url})`;

      const cleaned = cleanReply(reply);
      return res.json({ reply: cleaned });
    }

    // 👉 FAQ Fallback
    const faq = loadFaq();
    const faqMatch = faq.find(f => nmsg.includes(normalize(f.frage)));
    if (faqMatch) {
      return res.json({ reply: faqMatch.antwort });
    }

    // 👉 GPT Fallback
    const SYSTEM_PROMPT = `
Du bist Wisy, der Assistent von PDB Aesthetic Room Wiesbaden.
Antworte immer freundlich, professionell und maximal in 3 Sätzen.
Wenn keine Behandlung passt: lade höflich ein, unser [Kontaktformular](${CONTACT_URL}) zu nutzen.
Keine Telefon/E-Mail angeben.
`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ];

    const completion = await client.chat.completions.create({
      model: "o4-mini",
      max_completion_tokens: MAX_TOKENS,
      messages
    });

    let raw =
      completion.choices?.[0]?.message?.content?.trim() ||
      `Entschuldigung, ich habe dich nicht verstanden. Bitte nutze unser [Kontaktformular](${CONTACT_URL}).`;

    const cleaned = cleanReply(raw);
    return res.json({ reply: cleaned });

  } catch (err) {
    console.error("Fehler im /chat:", err);
    return res.json({
      reply: `Entschuldigung, es gab ein Problem. Bitte nutze unser [Kontaktformular](${CONTACT_URL}).`
    });
  }
});

/* ---------- Saubere Link-Formatierung ---------- */
function cleanReply(raw) {
  console.log("✅ cleanReply wurde ausgeführt:", raw.slice(0, 100));

  if (!raw) return "";

  let cleaned = raw;

  // Markdown-Links [Text](URL) → klickbare Buttons
  cleaned = cleaned.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    '<a href="$2" target="_blank" rel="noopener noreferrer" style="background:#007bff;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;font-weight:bold;margin-left:5px;display:inline-block;">$1</a>'
  );

  // "Mehr Infos hier:" entfernen
  cleaned = cleaned.replace(/Mehr Infos hier:?\s*/gi, "");

  // Doppelte Leerzeichen aufräumen
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}



/* ---------- Chat-Verlauf speichern ---------- */
app.post("/api/chat/session", async (req, res) => {
  const { session_id, messages } = req.body;
  if (!session_id || !Array.isArray(messages))
    return res.status(400).json({ ok: false });

  try {
    await pool.query(
      `INSERT INTO chat_sessions (session_id, messages)
       VALUES ($1, $2)
       ON CONFLICT (session_id)
       DO UPDATE SET messages=$2, updated_at=NOW()`,
      [session_id, JSON.stringify(messages)]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern:", err);
    res.status(500).json({ ok: false });
  }
});

/* ---------- Chat-Verlauf abrufen (A2: nur während Session) ---------- */
app.get("/api/chat/session/:session_id", async (req, res) => {
  const { session_id } = req.params;

  if (!session_id) return res.status(400).json({ messages: [] });

  try {
    const result = await pool.query(
      `SELECT messages FROM chat_sessions WHERE session_id=$1`,
      [session_id]
    );

    if (result.rows.length === 0) {
      return res.json({ messages: [] }); // Keine gespeicherten Daten
    }

    return res.json({ messages: result.rows[0].messages || [] });

  } catch (err) {
    console.error("❌ Fehler beim Laden:", err);
    return res.status(500).json({ messages: [] });
  }
});

/* ---------- Chat-Verlauf löschen (A2: bei X Button) ---------- */
app.delete("/api/chat/session/:session_id", async (req, res) => {
  const { session_id } = req.params;

  if (!session_id) return res.status(400).json({ ok: false });

  try {
    await pool.query(`DELETE FROM chat_sessions WHERE session_id=$1`, [session_id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Fehler beim Löschen:", err);
    return res.status(500).json({ ok: false });
  }
});



// =======================
// 🔹 TAG-KEYWORD-MAPPING
// =======================
const TAG_KEYWORDS = {
  hifu: ["hautstraffung", "falten", "erschlaffte haut"],
  ultherapy: ["hautstraffung", "falten"],
  exosomen: ["anti-aging", "zellregeneration", "hautverjuengung"],
  exosome: ["anti-aging", "zellregeneration"],
  morpheus: ["hautstraffung", "falten", "narben"],
  hydrafacial: ["unreine haut", "feuchtigkeit", "glow"],
  microneedling: ["akne", "narben", "poren"],
  laser: ["haarentfernung"],
  haarentfernung: ["haarentfernung"],
  botox: ["falten"],
  filler: ["volumen", "falten"]
};

function extractTagsFromMessage(message) {
  const text = normalize(message);
  const tags = new Set();

  treatments.forEach(t => {
    const wisy = t.wisy;
    if (!wisy?.triggers) return;

    wisy.triggers.forEach(trigger => {
      if (text.includes(normalize(trigger))) {
        (wisy.probleme || []).forEach(p => tags.add(p));
        (wisy.ziele || []).forEach(z => tags.add(z));
      }
    });
  });

  return Array.from(tags);
}


/* ---------- Wisy Chat Antwort (Matching & Buchung) ---------- */
app.post("/chat", async (req, res) => {

 // 🔹 1) Message & Tags auslesen
const msg = (req.body?.message || "").toString();

// 🔹 2) Tags automatisch aus Text extrahieren (triggers)
const tagsFromText = extractTagsFromMessage(msg);

// 🔹 3) Tags aus Frontend (falls vorhanden)
const tagsFromFrontend = Array.isArray(req.body?.tags) ? req.body.tags : [];

// 🔹 4) Zusammenführen (ohne Duplikate)
const tags = [...new Set([...tagsFromText, ...tagsFromFrontend])];


  // 🔹 Automatische Tags aus Text ableiten
let autoTags = [];

for (const key in TAG_KEYWORDS) {
  if (msg.includes(key)) {
    autoTags.push(...TAG_KEYWORDS[key]);
  }
}

// Manuelle + automatische Tags zusammenführen
const finalTags = [...new Set([...tags, ...autoTags])];


  try {

    // 🔹 2) Allgemeine Fragen ZUERST beantworten

    // Begrüßung
    if (/^(hi|hallo|hey|guten tag|guten morgen|guten abend)$/.test(msg)) {
      return res.json({
        reply: "Hallo! 😊 Wie kann ich dir weiterhelfen?"
      });
    }

    // Öffnungszeiten
    if (/öffnungszeit|offnungszeit|wann.*offen|geöffnet|geoeffnet/.test(msg)) {
      return res.json({
        reply:
          "Wir haben Montag, Dienstag, Donnerstag & Freitag von 10–18 Uhr geöffnet, Samstag von 10–15 Uhr. Mittwoch ist geschlossen."
      });
    }

    // Adresse
    if (/adresse|wo seid ihr|standort|wo finde ich euch/.test(msg)) {
      return res.json({
        reply: "Du findest uns in der Rheinstraße 59, 65185 Wiesbaden."
      });
    }

    // Parkplätze
    if (/parkplatz|parken|auto/.test(msg)) {
      return res.json({
        reply:
          "Parkmöglichkeiten gibt es direkt in der Rheinstraße sowie im Parkhaus Luisenforum."
      });
    }

    // 🔹 3) JETZT erst Matching
    const matches = matchTreatments(finalTags);

    const reply = buildReply(matches);
    return res.json({ reply });

  } catch (err) {
    console.error("❌ Fehler im Wisy-Chat:", err);
    return res.status(500).json({
      reply: "⚠️ Es ist ein Fehler aufgetreten. Bitte versuche es erneut."
    });
  }
});


/* ---------- Server starten ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
