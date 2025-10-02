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

/* ------------------------- Utils ------------------------- */
function forceMarkdownLink(text) {
  if (!text) return "";
  let out = text;

  const urlEsc = CONTACT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mdLinkStr = `\\[\\s*Kontaktformular\\s*\\]\\(${urlEsc}\\)`;
  const mdLinkRe = new RegExp(mdLinkStr, "i");

  // Falls kein Markdown-Link existiert → URL ersetzen
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

/* ---------- Treatments laden ---------- */
function loadTreatments() {
  const raw = JSON.parse(fs.readFileSync(new URL("./treatments.json", import.meta.url)));
  return raw.map(t => ({
    name: t.treatment || t.name || "",
    beschreibung: t.description || t.beschreibung || "",
    preis: t.preis || "",
    url: t.url || CONTACT_URL
  }));
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

function smartFindTreatment(query, treatments) {
  if (!query) return null;
  const candidates = treatments
    .map(t => ({ t, s: scoreMatch(query, t) }))
    .sort((a, b) => b.s - a.s);
  const best = candidates[0];
  return best && best.s >= 30 ? best.t : null;
}

function detectIntent(msg) {
  const n = normalize(msg);
  return {
    isPrice: /(preis|kosten|kostet|€|euro|teuer|angebot)/.test(n),
    isWhat: /(was ist|erklaer|erklär|wirkung|info|geeignet|empfehlung)/.test(n),
    isGreet: /^(hi|hallo|hey|servus|moin|guten (tag|morgen|abend))/.test(n),
    isBooking: /(termin|buchen|buchung|verfuegbar|verfügbar|wann)/.test(n)
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
  const mtime = fs.statSync(new URL("./treatments.json", import.meta.url)).mtime.toISOString();
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
  console.log("🔥 Neue Version läuft! Chat-Route betreten.");
  const userMessage = (req.body.message || "").toString().slice(0, 300);
  console.log("UserMessage:", userMessage);

  const MAX_TOKENS = 120;
  try {
    const intent = detectIntent(userMessage);

    // 👉 Eigene Antwort bei Begrüßung
    if (intent.isGreet) {
      return res.json({ reply: "Hallo! Wie kann ich Ihnen heute weiterhelfen?" });
    }

    const treatments = loadTreatments();
    const best = smartFindTreatment(userMessage, treatments);

    // 🟢 Debug-Ausgabe ins Log
    console.log("BestMatch:", best ? best.name : "❌ Kein Treffer (GPT-Fallback)");

    // ✅ Direkte Antwort aus JSON, wenn Behandlung erkannt
    if (best) {
      let reply;
      const desc = (best.beschreibung || "").replace(/\s+/g, " ");

      if (intent.isWhat) {
        reply = `${best.name}: ${desc} Preis: ${best.preis}. Mehr Infos hier: ${best.url}`;
      } else if (intent.isPrice) {
        reply = `${best.name}: Preis ${best.preis}. Mehr Infos hier: ${best.url}`;
      } else {
        reply = `${best.name}: ${desc}. Mehr Infos hier: ${best.url}`;
      }

      return res.json({ reply: forceMarkdownLink(reply) });
    }

    // ❌ Wenn keine Behandlung gefunden → GPT fragen
    const SYSTEM_PROMPT =
`Du bist Wisy, der Assistent von PDB Aesthetic Room Wiesbaden.
Antworte immer freundlich, professionell und maximal in 3 Sätzen.
Wenn keine Behandlung passt: lade höflich ein, unser [Kontaktformular](${CONTACT_URL}) zu nutzen.
Keine Telefon/E-Mail angeben.`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ];

    const ask = async (model) => client.chat.completions.create({
      model,
      max_completion_tokens: MAX_TOKENS,
      messages
    });

    let completion;
    try {
      completion = await ask("o4-mini");
    } catch (err) {
      if (err?.status === 429) {
        console.warn("429 – fallback auf gpt-5-nano");
        completion = await ask("gpt-5-nano");
      } else {
        throw err;
      }
    }

    const raw = completion.choices?.[0]?.message?.content?.trim()
      || "Entschuldigung, ich habe dich nicht verstanden.";
    const reply = forceMarkdownLink(raw);

    console.log("Antwort von GPT:", reply);

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
