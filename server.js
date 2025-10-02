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

/* ------------------------- Utils ------------------------- */
function forceMarkdownLink(text) {
  if (!text) return "";
  let out = text;

  // Kontaktformular-Link IMMER als Markdown
  const urlEsc = CONTACT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mdLinkStr = `\\[\\s*Kontaktformular\\s*\\]\\(${urlEsc}\\)`;
  const mdLinkRe = new RegExp(mdLinkStr, "i");

  if (!mdLinkRe.test(out)) {
    out = out.replace(new RegExp(urlEsc, "g"), `[Kontaktformular](${CONTACT_URL})`);
  }
  return out.trim();
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

/* ---------- /chat ---------- */
app.post("/chat", async (req, res) => {
  if (DEBUG) console.log("🔥 Chat-Route gestartet");
  const userMessage = (req.body.message || "").toString().slice(0, 300);
  if (DEBUG) console.log("UserMessage:", userMessage);

  const MAX_TOKENS = 120;
  try {
    const intent = detectIntent(userMessage);
    const nmsg = normalize(userMessage);

    // 👉 Begrüßung
    if (intent.isGreet) {
      return res.json({ reply: "Hallo! Wie kann ich Ihnen heute weiterhelfen?" });
    }

    // 👉 Öffnungszeiten (direkt, robust)
    if (intent.isOpening || /offen|geoeffnet|geöffnet|öffnungszeiten|wann/.test(nmsg)) {
      return res.json({
        reply: "Wir haben Montag, Dienstag, Donnerstag und Freitag 10:00-18:00 Uhr, Samstag von 10:00–15:00 Uhr geöffnet. Mittwoch geschlossen"
      });
    }

    // 👉 Adresse
    if (/adresse|wo seid ihr|standort|wo finde ich euch/.test(nmsg)) {
      return res.json({
        reply: "PDB Aesthetic Room, Rheinstr. 59, 65185 Wiesbaden."
      });
    }

    // 👉 Parkplatz
    if (/park(en|platz)|auto|parken/.test(nmsg)) {
      return res.json({
        reply: "Parkmöglichkeiten findest du direkt in der Rheinstraße sowie im Parkhaus Luisenforum."
      });
    }

    // 👉 Treatments laden
    const treatments = loadTreatments();
    const best = smartFindTreatment(userMessage, treatments);

    if (best) {
      const desc = (best.beschreibung || "").split(".")[0];
      let reply = `${best.name}: ${desc}.`;
      if (intent.isPrice && best.preis) reply += ` Preis: ${best.preis}.`;
      reply += ` Mehr Infos hier: ${makeMarkdownLink("Behandlung ansehen", best.url)}`;
      return res.json({ reply: forceMarkdownLink(reply) });
    }

    // 👉 FAQ fallback (falls du noch andere drin hast)
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

    const raw = completion.choices?.[0]?.message?.content?.trim()
      || `Entschuldigung, ich habe dich nicht verstanden. Bitte nutze unser [Kontaktformular](${CONTACT_URL}).`;
    const reply = forceMarkdownLink(raw);

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
