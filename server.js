import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import os from "os";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";

const DEBUG = process.env.DEBUG === "true";
const MAX_DESC_CHARS = parseInt(process.env.MAX_DESC_CHARS || "240", 10);
const MAX_DESC_SENTENCES = parseInt(process.env.MAX_DESC_SENTENCES || "2", 10);

/* ------------------------- Utils ------------------------- */
function forceMarkdownLink(text) {
  if (!text) return "";
  let out = text;

  const urlEsc = CONTACT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mdLinkStr = `\\[\\s*Kontaktformular\\s*\\]\\(${urlEsc}\\)`;
  const mdLinkRe = new RegExp(mdLinkStr, "i");

  if (!mdLinkRe.test(out)) {
    out = out.replace(new RegExp(urlEsc, "g"), `[Kontaktformular](${CONTACT_URL})`);
  }
  return out.trim();
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
  a = normalize(a); b = normalize(b);
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

/* ---- Text kürzen: max. 2 Sätze / 240 Zeichen ---- */
function firstSentences(text, maxSentences = 2) {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  const parts = clean.split(/(?<=[.!?])\s+/);
  return parts.slice(0, maxSentences).join(" ");
}
function shortenDesc(text) {
  const s = firstSentences(text, MAX_DESC_SENTENCES);
  if (s.length <= MAX_DESC_CHARS) return s;
  return s.slice(0, MAX_DESC_CHARS - 1).trim() + "…";
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

/* Synonymerkennung (Conditions → Behandlungen) */
function synonymFind(query, treatments) {
  const n = normalize(query);

  // Haare / Rückenhaare → Laser
  if (/\bhaare|haarentfernung|ruecken|rücken\b/.test(n)) {
    let t = treatments.find(x => /alexandrit|laser/i.test(x.name));
    if (!t) t = treatments.find(x => /laser/i.test(x.name));
    return t || null;
  }

  // Akne / unreine Haut → Akne, Hydrafacial, Peel, Microneedling, Herbs2Peel
  if (/\bakne|pickel|unreine haut|entzue(nd|nd)|entzünd/i.test(n)) {
    let t =
      treatments.find(x => /akne/i.test(x.name)) ||
      treatments.find(x => /hydrafacial/i.test(x.name)) ||
      treatments.find(x => /peel|peeling/i.test(x.name)) ||
      treatments.find(x => /microneedling/i.test(x.name)) ||
      treatments.find(x => /herbs/i.test(x.name));
    return t || null;
  }

  return null;
}

function smartFindTreatment(query, treatments) {
  if (!query) return null;

  // 1) Condition-Synonyme zuerst
  const syn = synonymFind(query, treatments);
  if (syn) return syn;

  // 2) Fuzzy Matching
  const candidates = treatments
    .map(t => ({ t, s: scoreMatch(query, t) }))
    .sort((a, b) => b.s - a.s);
  const best = candidates[0];
  return best && best.s >= 40 ? best.t : null; // leicht strenger
}

function detectIntent(msg) {
  const n = normalize(msg);
  return {
    isPrice: /(preis|kosten|kostet|€|euro|teuer|angebot)/.test(n),
    isWhat: /(was ist|erklaer|erklär|wirkung|info|geeignet|empfehlung)/.test(n),
    isGreet: /\b(hi|hallo|hey|servus|moin|guten (tag|morgen|abend))\b/.test(n),
    isBooking: /(termin|buchen|buchung|verfuegbar|verfügbar|wann)/.test(n)
  };
}

/* Einheitliche Kurz-Antwort bauen */
function buildReply(best, intent) {
  const desc = shortenDesc(best.beschreibung || "");
  const hasPrice = !!best.preis;
  const url = best.url || CONTACT_URL; // falls im JSON vergessen

  if (intent.isPrice && hasPrice) {
    return forceMarkdownLink(`${best.name}: Preis ${best.preis}. Mehr Infos hier: ${url}`);
  }

  if (intent.isWhat) {
    return forceMarkdownLink(`${best.name}: ${desc}${hasPrice ? ` Preis: ${best.preis}.` : ""} Mehr Infos hier: ${url}`);
  }

  // neutral/kurz
  return forceMarkdownLink(`${best.name}: ${desc}${hasPrice ? ` Preis: ${best.preis}.` : ""} Mehr Infos hier: ${url}`);
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
  let mtime = "";
  try {
    mtime = fs.statSync(new URL("./treatments.json", import.meta.url)).mtime.toISOString();
  } catch {}
  res.json({
    service: "wisy-backend",
    pid: process.pid,
    host: os.hostname(),
    cwd: process.cwd(),
    treatmentsPath: path,
    treatmentsMtime: mtime,
    treatmentsSample: stats,
    time: new Date().toISOString()
  });
});

/* ---------- /chat ---------- */
app.post("/chat", async (req, res) => {
  if (DEBUG) console.log("🔥 Chat-Route gestartet");
  const userMessage = (req.body.message || "").toString().slice(0, 300);
  if (DEBUG) console.log("UserMessage:", userMessage);

  const MAX_TOKENS = 120;
  try {
    const intent = detectIntent(userMessage);

    // Begrüßung
    if (intent.isGreet) {
      return res.json({ reply: "Hallo! Wie kann ich Ihnen heute weiterhelfen?" });
    }

    const treatments = loadTreatments();
    const best = smartFindTreatment(userMessage, treatments);

    if (DEBUG) console.log("BestMatch:", best ? best.name : "❌ Kein Treffer (GPT-Fallback)");

    // ✅ JSON-Antwort wenn Treffer (kurz!)
    if (best) {
      const reply = buildReply(best, intent);
      return res.json({ reply });
    }

    // ❌ Kein Treffer → GPT fallback (max. 3 Sätze)
    const SYSTEM_PROMPT =
`Du bist Wisy, der Assistent von PDB Aesthetic Room Wiesbaden.
Antworte immer freundlich, professionell und maximal in 3 Sätzen.
Wenn keine Behandlung passt: lade höflich ein, unser [Kontaktformular](${CONTACT_URL}) zu nutzen.
Keine Telefon/E-Mail angeben.`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ];

    const completion = await client.chat.completions.create({
      model: "o4-mini",
      max_completion_tokens: MAX_TOKENS,
      messages
    });

    const raw = completion.choices?.[0]?.message?.content?.trim()
      || "Entschuldigung, ich habe dich nicht verstanden. Bitte nutze unser [Kontaktformular](${CONTACT_URL}).";
    const reply = forceMarkdownLink(raw);

    if (DEBUG) console.log("Antwort von GPT:", reply);
    return res.json({ reply });

  } catch (err) {
    console.error("Fehler im /chat:", err);
    return res.json({
      reply: `Entschuldigung, es gab ein Problem. Bitte nutze unser [Kontaktformular](${CONTACT_URL}).`
    });
  }
});

/* ---------- Server starten ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
