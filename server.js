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

// Request-Logger
app.use((req, _res, next) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  console.log(`[REQ] ${req.method} ${req.url} | origin=${req.headers.origin || "-"} | ip=${ip}`);
  next();
});

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";

/* ------------------------- Utils ------------------------- */
function forceMarkdownLink(text) {
  if (!text) return "";
  let out = text;
  const urlEsc = CONTACT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mdLinkStr = `\\[\\s*Kontaktformular\\s*\\]\\(${urlEsc}\\)`;
  const mdLinkRe = new RegExp(mdLinkStr, "i");
  out = out.replace(/\[\s*Kontaktformular\s*\]\(\s*Kontaktformular\s*\)/gi, `[Kontaktformular](${CONTACT_URL})`);
  const htmlOurUrl = new RegExp(`<a[^>]*href=["']${urlEsc}["'][^>]*>[^<]*<\\/a>`, "i");
  if (htmlOurUrl.test(out)) out = out.replace(htmlOurUrl, `[Kontaktformular](${CONTACT_URL})`);
  if (!mdLinkRe.test(out)) out = out.replace(new RegExp(urlEsc, "g"), `[Kontaktformular](${CONTACT_URL})`);
  out = out
    .replace(new RegExp(`Kontaktformular\\s*[:\\-–—]?\\s*(${mdLinkStr})`, "gi"), "$1")
    .replace(new RegExp(`(${mdLinkStr})\\s*[:\\-–—]?\\s*Kontaktformular`, "gi"), "$1");
  out = out.replace(new RegExp(`(${mdLinkStr})([\\.,!\\?])(\\s|$)`, "gi"), "$1 $2$3");
  return out.trim();
}

function normalize(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")         // Akzente weg
    .replace(/[–—−]/g, "-")                  // Gedankenstriche vereinheitlichen
    .replace(/[^a-z0-9\-+ ]+/g, " ")         // Sonderzeichen raus
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  return normalize(s).split(" ").filter(w => w.length > 2);
}

function loadTreatments() {
  const raw = JSON.parse(fs.readFileSync(new URL("./treatments.json", import.meta.url)));
  return raw.map(t => {
    if (t.treatment || t.description || t.areas) {
      return {
        name: t.treatment || t.name || "",
        beschreibung: t.description || t.beschreibung || "",
        preis: Array.isArray(t.areas) && t.areas.length
          ? t.areas.map(a => `${a.name}: ${a.price} €`).join(" / ")
          : (t.preis != null ? `${t.preis} €` : "Preis auf Anfrage"),
        duration: t.duration || t.dauer || null,
      };
    }
    return {
      name: t.name || "",
      beschreibung: t.beschreibung || "",
      preis: t.preis != null ? `${t.preis} €` : "Preis auf Anfrage",
      duration: t.dauer || t.duration || null,
    };
  });
}

function findTreatment(query, treatments) {
  const qWords = tokenize(query);
  if (!qWords.length) return null;
  return treatments.find(t => {
    const nameNorm = normalize(t.name);
    return qWords.some(w => nameNorm.includes(w));
  }) || null;
}

/* ------------------------- Routes ------------------------- */

app.get("/", (_req, res) => res.send("OK"));

// --- NEU: Check-Endpoint um den Live-Inhalt der treatments.json zu sehen ---
app.get("/check-treatments", (_req, res) => {
  try {
    const raw = fs.readFileSync(new URL("./treatments.json", import.meta.url), "utf8");
    // nur die ersten 500 Zeichen, damit es nicht zu groß wird
    res.type("text/plain").send(raw.slice(0, 500));
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Lesen der Datei");
  }
});

// Chat-Endpoint
app.post("/chat", async (req, res) => {
  console.log("UserMessage:", req.body.message);

  try {
    const userMessage = (req.body.message || "").toString().slice(0, 1000);
    const treatments = loadTreatments();

    const match = findTreatment(userMessage, treatments);
    if (match) {
      const d = match.duration ? ` – Dauer: ${match.duration}` : "";
      return res.json({ reply: `${match.name}: ${match.preis}${d}` });
    }

    // sonst GPT befragen
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `Du bist Wisy, ein Beratungsassistent für PDB Aesthetic Room (PDB).
ANTWORTE IMMER IN MAXIMAL VIER SÄTZEN. Schreibe nie mehr als vier Sätze.
Antworte auf Deutsch, freundlich und professionell.

Wenn der Nutzer nach konkreten Behandlungen oder Preisen fragt,
nutze vorrangig diese Liste:
${treatments.map(t => `• ${t.name}: ${t.preis} – ${t.beschreibung}`).join("\n")}

Falls die gewünschte Behandlung hier nicht aufgeführt ist,
gib allgemeine, hilfreiche Informationen und lade den Nutzer ein,
über folgenden Link Kontakt aufzunehmen:
${CONTACT_URL}

Wichtig:
– Schreibe den Hinweis auf das Kontaktformular immer nur EINMAL,
  direkt als klickbaren Link im Format [Kontaktformular](${CONTACT_URL}).
– Erfinde niemals eine andere E-Mail-Adresse oder Telefonnummer.
– Verwende niemals den Satz „Ich habe keine Informationen“.`
        },
        { role: "user", content: userMessage },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim()
               || "Entschuldigung, ich habe dich nicht verstanden.";
    const reply = forceMarkdownLink(raw);
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Abrufen der KI-Antwort");
  }
});

// Debug-Endpunkt: gezielte Suche testen
app.get("/debug/find", (req, res) => {
  const treatments = loadTreatments();
  const q = (req.query.q || "").toString();
  const found = findTreatment(q, treatments);
  if (!found) return res.json({ q, found: false });
  res.json({ q, found: true, name: found.name, preis: found.preis, duration: found.duration || null });
});

// Status-Endpunkt
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
