import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import os from "os";
import pkg from "pg";
import { handleGeneralQuestions } from "./utils/handleGeneralQuestions.js";
import {
  detectIntentFromTagsOrText,
  initDecisionContext,
  refineCandidates,
  getAxisQuestion,
  mapAxisAnswer,
  getClarifyingQuestion
} from "./utils/decisionRuntime.js";

// =========================
// ENV
// =========================
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const DEBUG = process.env.DEBUG === "true";

// =========================
// DB (Chat Sessions)
// =========================
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// =========================
// App
// =========================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// =========================
// Constants
// =========================
const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";

// =========================
// OpenAI
// =========================
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askChatGPT(message) {
  // harte Absicherung: nur allgemeine Fragen
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `
Du bist Wisy, der digitale Assistent von PDB Aesthetic Room in Wiesbaden.

WICHTIGE REGELN:
- Du beantwortest NUR allgemeine Fragen.
- Du empfiehlst KEINE Behandlungen.
- Du nennst KEINE Preise.
- Du vergleichst KEINE Methoden.
- Wenn eine Frage nach "welche Behandlung" / "was hilft gegen ..." klingt, verweise freundlich auf Beratung/Kontakt.

Erlaubt:
- Begrüßung
- Öffnungszeiten
- Adresse & Parkplatz
- Gutscheine
- Termin/ Beratung Ablauf
- Allgemeine Infos zum Institut

Ton:
- professionell
- ruhig
- ästhetisch-medizinisch
- nicht werblich
`
      },
      { role: "user", content: message }
    ]
  });

  const text = completion.choices?.[0]?.message?.content || "";
  return cleanReply(text);
}

// =========================
// Treatments + Matching
// =========================
const treatments = JSON.parse(
  fs.readFileSync(new URL("./treatments.json", import.meta.url), "utf8")
);

function matchTreatments(tags) {
  if (!Array.isArray(tags)) return [];
  if (!Array.isArray(treatments)) return [];

  const scored = treatments.map((t) => {
    let score = 0;
    if (!t.wisy) return { ...t, score: 0 };

    tags.forEach((tag) => {
      if (t.wisy.probleme?.includes(tag)) score += 3;
      if (t.wisy.ziele?.includes(tag)) score += 2;
      if (t.wisy.hauttypen?.includes(tag)) score += 1;
    });

    return { ...t, score };
  });

  return scored
    .filter((t) => t.score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
}

function shouldDirectToBooking(matches) {
  if (!Array.isArray(matches)) return false;
  if (matches.length !== 1) return false;
  const t = matches[0];
  return Boolean(t?.url);
}

function buildReply(matches) {
  if (!matches?.length) {
    return `
      Ich möchte dir nichts Falsches empfehlen.<br><br>
      👉 <a href="${CONTACT_URL}">Kurze Beratung anfragen</a>
    `;
  }

  // ✅ EIN klares Match → DIREKT BUCHEN
  if (shouldDirectToBooking(matches)) {
    const t = matches[0];
    const title = t.treatment || t.name || "Behandlung";
    const url = t.url || CONTACT_URL;

    return `
      Basierend auf deiner Beschreibung kann <strong>${title}</strong> gut passen.<br><br>
      👉 <a href="${url}" target="_blank" rel="noopener noreferrer">Mehr Infos & Termin</a>
    `;
  }

  // ✅ Mehrere Matches → Auswahl anzeigen
  const items = matches
    .map((t) => {
      const title = t.treatment || t.name || "Behandlung";
      const url = t.url || CONTACT_URL;
      return `• <a href="${url}" target="_blank" rel="noopener noreferrer">${title}</a>`;
    })
    .join("<br>");

  return `
    Ich habe 2 passende Möglichkeiten gefunden:<br><br>
    ${items}<br><br>
    Wenn du willst, sag mir kurz: <strong>Hauttyp</strong> & <strong>Hauptziel</strong> (z. B. Akne / Glow / Straffung).
  `;
}

// =========================
// Text utils
// =========================
function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * optional: hübschere Links + Cleanup für GPT Output
 */
function cleanReply(text = "") {
  let cleaned = String(text);

  // Markdown Links [Text](url) → HTML Link
  cleaned = cleaned.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  cleaned = cleaned.replace(/Mehr Infos hier:?\s*/gi, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return cleaned;
}

// =========================
// Tags aus Text (dein Trigger System)
// =========================
function extractTagsFromMessage(message) {
  const text = normalize(message);
  const tags = new Set();

  treatments.forEach((t) => {
    const wisy = t.wisy;
    if (!wisy?.triggers) return;

    wisy.triggers.forEach((trigger) => {
      if (text.includes(normalize(trigger))) {
        (wisy.probleme || []).forEach((p) => tags.add(p));
        (wisy.ziele || []).forEach((z) => tags.add(z));
      }
    });
  });

  return Array.from(tags);
}

async function loadChatSession(session_id) {
  if (!session_id) return { messages: [], state: {} };

  const result = await pool.query(
    `SELECT messages FROM chat_sessions WHERE session_id=$1`,
    [session_id]
  );

  if (result.rows.length === 0) return { messages: [], state: {} };

  const stored = result.rows[0].messages;

  // Rückwärtskompatibel: früher war es ein Array
  if (Array.isArray(stored)) {
    return { messages: stored, state: {} };
  }

  // Neu: Objekt {messages, state}
  if (stored && typeof stored === "object") {
    return {
      messages: Array.isArray(stored.messages) ? stored.messages : [],
      state: stored.state && typeof stored.state === "object" ? stored.state : {}
    };
  }

  return { messages: [], state: {} };
}

async function saveChatSession(session_id, messages, state) {
  if (!session_id) return;

  const payload = { messages, state };

  await pool.query(
    `INSERT INTO chat_sessions (session_id, messages)
     VALUES ($1, $2)
     ON CONFLICT (session_id)
     DO UPDATE SET messages=$2, updated_at=NOW()`,
    [session_id, JSON.stringify(payload)]
  );
}



// =========================
// Routes
// =========================
app.get("/", (_req, res) => res.send("OK"));

app.get("/whoami", (_req, res) => {
  const p = new URL("./treatments.json", import.meta.url).pathname;
  let stats = { count: 0, names: [] };

  try {
    const raw = JSON.parse(
      fs.readFileSync(new URL("./treatments.json", import.meta.url), "utf8")
    );
    stats = {
      count: raw.length || 0,
      names: raw.slice(0, 3).map((x) => x.treatment || x.name)
    };
  } catch {}

  res.json({
    service: "wisy-backend",
    pid: process.pid,
    host: os.hostname(),
    cwd: process.cwd(),
    treatmentsPath: p,
    treatmentsSample: stats,
    time: new Date().toISOString()
  });
});

// =========================
// Chat Verlauf speichern / laden / löschen (DB)
// =========================
app.post("/api/chat/session", async (req, res) => {
  const { session_id, messages } = req.body;

  if (!session_id || !Array.isArray(messages)) {
    return res.status(400).json({ ok: false });
  }

  try {
    await pool.query(
      `INSERT INTO chat_sessions (session_id, messages)
       VALUES ($1, $2)
       ON CONFLICT (session_id)
       DO UPDATE SET messages=$2, updated_at=NOW()`,
      [session_id, JSON.stringify(messages)]
    );

    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Fehler beim Speichern:", err);
    return res.status(500).json({ ok: false });
  }
});

app.get("/api/chat/session/:session_id", async (req, res) => {
  const { session_id } = req.params;

  if (!session_id) return res.status(400).json({ messages: [] });

  try {
    const result = await pool.query(
      `SELECT messages FROM chat_sessions WHERE session_id=$1`,
      [session_id]
    );

    if (result.rows.length === 0) {
      return res.json({ messages: [] });
    }

    return res.json({ messages: result.rows[0].messages || [] });
  } catch (err) {
    console.error("❌ Fehler beim Laden:", err);
    return res.status(500).json({ messages: [] });
  }
});

app.delete("/api/chat/session/:session_id", async (req, res) => {
  const { session_id } = req.params;

  if (!session_id) return res.status(400).json({ ok: false });

  try {
    await pool.query(`DELETE FROM chat_sessions WHERE session_id=$1`, [
      session_id
    ]);
    return res.json({ ok: true });
  } catch (err) {
    console.error("❌ Fehler beim Löschen:", err);
    return res.status(500).json({ ok: false });
  }
});


// =========================
// Main Chat (Decision Mode – persistent)
// =========================
app.post("/chat", async (req, res) => {
  try {
    const raw = (req.body?.message || "").toString();
    const session_id = (req.body?.session_id || "").toString();

    // 🔥 ZENTRALE NORMALISIERUNG (DAS WAR DER FEHLER)
    const msgRaw = raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

    // 0) Session laden
    const session = await loadChatSession(session_id);
    const state = session.state || {};
    const decision = state.decisionContext || null;

    // 1) Tags
    const tagsFromText = extractTagsFromMessage(msgRaw);
    const tagsFromFrontend = Array.isArray(req.body?.tags) ? req.body.tags : [];
    const tags = [...new Set([...tagsFromText, ...tagsFromFrontend])];

    // =====================================================
    // 2) Decision Context aktiv → Achsen & Klarstellung
    // =====================================================
    if (decision?.active && Array.isArray(decision.candidates)) {
      const intent = decision.intent;

      // 🔹 Achsen-Antwort erkennen (JETZT ZUVERLÄSSIG)
      const axisAnswer = mapAxisAnswer(intent, msgRaw);

      // =========================
      // 🔥 HARD STOP BEI AXIS
      // =========================
      if (axisAnswer) {
        const clarification = getClarifyingQuestion(intent, axisAnswer);

        // 👉 Klarstellungsfrage IMMER stellen
        if (clarification) {
          decision.clarified = clarification;
          state.decisionContext = decision;
          await saveChatSession(session_id, session.messages || [], state);

          return res.json({
            reply: clarification.question
          });
        }

        // 👉 sonst normal verfeinern
        const refined = refineCandidates(intent, decision.candidates, axisAnswer);
        decision.candidates = refined;
        state.decisionContext = decision;
        await saveChatSession(session_id, session.messages || [], state);

        return res.json({
          reply:
            buildReply(decision.candidates) +
            "<br><br>Magst du mir noch **ein Detail** nennen?"
        });
      }

      // =========================
      // 🔹 KEINE AXIS → normaler Decision-Flow
      // =========================
      if (decision.candidates.length === 1) {
        state.decisionContext = null;
        await saveChatSession(session_id, session.messages || [], state);
        return res.json({ reply: buildReply(decision.candidates) });
      }

      state.decisionContext = decision;
      await saveChatSession(session_id, session.messages || [], state);

      return res.json({
        reply:
          buildReply(decision.candidates) +
          "<br><br>Magst du mir noch **ein Detail** nennen (z. B. Region, empfindliche Haut, sofortiger Effekt)?"
      });
    }

    // =========================
    // 3) Normales Matching
    // =========================
    const matches = matchTreatments(tags);

    // 4) Mehrere Matches → Decision starten
    if (matches.length > 1) {
      const intent = detectIntentFromTagsOrText(tags, msgRaw);
      state.decisionContext = initDecisionContext(intent || "hautstruktur", matches);
      await saveChatSession(session_id, session.messages || [], state);
      const q = getAxisQuestion(intent);
      return res.json({ reply: q || buildReply(matches) });
    }

    // 5) Allgemeine Fragen
    if (matches.length === 0) {
      const generalAnswer = await handleGeneralQuestions(msgRaw, askChatGPT);
      if (generalAnswer) {
        await saveChatSession(session_id, session.messages || [], state);
        return res.json({ reply: generalAnswer });
      }
    }

    // 6) Fallback
    const reply = buildReply(matches);
    await saveChatSession(session_id, session.messages || [], state);
    return res.json({ reply });

  } catch (err) {
    console.error("❌ Fehler im Wisy-Chat:", err);
    return res.status(500).json({
      reply: "⚠️ Es ist ein Fehler aufgetreten. Bitte versuche es erneut."
    });
  }
});

// =========================
// Start
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend läuft auf Port ${PORT}`));
