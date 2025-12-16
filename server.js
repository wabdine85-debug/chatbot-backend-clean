import express from "express";
import cors from "cors";

import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import os from "os";

import { loadOrCreateSession, saveSession } from "./wisySessions.js";

import { handleGeneralQuestions } from "./utils/handleGeneralQuestions.js";
import {
  detectIntentFromTagsOrText,
  initDecisionContext,
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

// =========================
// App
// =========================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";

// =========================
// OpenAI
// =========================
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askChatGPT(message) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3,
    messages: [
      {
        role: "system",
        content: `
Du bist Wisy, der digitale Assistent von PDB Aesthetic Room in Wiesbaden.

REGELN:
- Nur allgemeine Fragen beantworten
- Keine Behandlungen empfehlen
- Keine Preise nennen
- Bei Behandlungsfragen → Beratung verweisen
`
      },
      { role: "user", content: message }
    ]
  });

  return completion.choices?.[0]?.message?.content || "";
}

// =========================
// Treatments
// =========================
const treatments = JSON.parse(
  fs.readFileSync(new URL("./treatments.json", import.meta.url), "utf8")
);

function normalize(s = "") {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

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

function matchTreatments(tags) {
  if (!Array.isArray(tags)) return [];

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

function buildReply(matches) {
  if (!matches?.length) {
    return `
      Ich möchte dir nichts Falsches empfehlen.<br><br>
      👉 <a href="${CONTACT_URL}">Kurze Beratung anfragen</a>
    `;
  }

  // ✅ EIN klares Match
  if (matches.length === 1 && matches[0]?.url) {
    const t = matches[0];
    const title = t.treatment || t.name || t.title || "Behandlung";

    return `
      Basierend auf deiner Beschreibung kann <strong>${title}</strong> gut passen.<br><br>
      👉 <a href="${t.url}" target="_blank">Mehr Infos & Termin</a>
    `;
  }

  // ✅ MEHRERE Matches
  const items = matches
    .map((t) => {
      const title = t.treatment || t.name || t.title || "Behandlung";
      return `• <a href="${t.url}" target="_blank">${title}</a>`;
    })
    .join("<br>");

  return `
    Ich habe 2 passende Möglichkeiten gefunden:<br><br>
    ${items}<br><br>
    Magst du mir noch sagen, was dir wichtiger ist (z. B. Akne, Glow, Straffung)?
  `;
}

// =========================
// ROUTES
// =========================
app.get("/", (_req, res) => res.send("OK"));

app.get("/whoami", (_req, res) => {
  res.json({
    service: "wisy-backend",
    host: os.hostname(),
    time: new Date().toISOString()
  });
});

// =========================
// MAIN CHAT (FINAL)
// =========================
app.post("/api/chat", async (req, res) => {
  try {
    const rawMessage = String(req.body?.message || "");
    const incomingSessionId = req.body?.session_id || null;

    const session = await loadOrCreateSession(incomingSessionId);
    const session_id = session.session_id;
    const state = session.state || {};
    const messages = Array.isArray(session.messages) ? session.messages : [];

    const msgRaw = normalize(rawMessage);

    // TAGS IMMER DEFINIEREN (Crash-Fix)
    let tags = [];
    try {
      const tagsFromText = extractTagsFromMessage(msgRaw);
      tags = Array.isArray(tagsFromText) ? tagsFromText : [];
    } catch (e) {
      console.error("❌ TAG ERROR", e);
      tags = [];
    }

    console.log("🧪 CHAT HIT", { msgRaw, session_id, tags });

    // ===== MATCHING =====
    const matches = matchTreatments(tags);

    // ===== GENERAL (GPT) NUR WENN KEINE TAGS =====
    if (tags.length === 0) {
      const generalAnswer = await handleGeneralQuestions(msgRaw, askChatGPT);
      if (generalAnswer) {
        await saveSession(session_id, messages, state);
        return res.json({ reply: generalAnswer, session_id });
      }
    }

    // ===== FALLBACK =====
    const reply = buildReply(matches);
    await saveSession(session_id, messages, state);
    return res.json({ reply, session_id });

  } catch (err) {
    console.error("❌ CHAT CRASH", err);
    return res.status(200).json({
      reply: "Technischer Fehler (debug active)",
      session_id: req.body?.session_id || null
    });
  }
});


// =========================
// START
// =========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Wisy Backend läuft auf Port ${PORT}`)
);
