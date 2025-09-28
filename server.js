import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";

// Behandlungsdaten aus JSON laden
const treatments = JSON.parse(
  fs.readFileSync(new URL("./treatments.json", import.meta.url))
);

// Hilfsfunktion: genau EIN sauberer Markdown-Link, Duplikate vermeiden
function forceMarkdownLink(text) {
  if (!text) return "";

  let out = text;
  const urlEsc = CONTACT_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mdLinkStr = `\\[\\s*Kontaktformular\\s*\\]\\(${urlEsc}\\)`;
  const mdLinkRe = new RegExp(mdLinkStr, "i");

  // 0) Kaputte Variante wie [Kontaktformular](Kontaktformular) → reparieren
  out = out.replace(/\[\s*Kontaktformular\s*\]\(\s*Kontaktformular\s*\)/gi,
                    `[Kontaktformular](${CONTACT_URL})`);

  // 1) HTML-Anker mit unserer URL → Markdown-Link
  const htmlOurUrl = new RegExp(`<a[^>]*href=["']${urlEsc}["'][^>]*>[^<]*<\\/a>`, "i");
  if (htmlOurUrl.test(out)) {
    out = out.replace(htmlOurUrl, `[Kontaktformular](${CONTACT_URL})`);
  }

  // 2) Wenn noch kein korrekter Markdown-Link existiert → nackte URL zu Markdown-Link
  if (!mdLinkRe.test(out)) {
    const rawUrlRe = new RegExp(urlEsc, "g");
    out = out.replace(rawUrlRe, `[Kontaktformular](${CONTACT_URL})`);
  }

  // 3) Lose „Kontaktformular“-Wörter direkt vor/nach dem Link entfernen (Duplikate)
  out = out
    .replace(new RegExp(`Kontaktformular\\s*[:\\-–—]?\\s*(${mdLinkStr})`, "gi"), "$1")
    .replace(new RegExp(`(${mdLinkStr})\\s*[:\\-–—]?\\s*Kontaktformular`, "gi"), "$1");

  // 4) Satzzeichen direkt nach dem Link sauber abtrennen
  out = out.replace(new RegExp(`(${mdLinkStr})([\\.,!\\?])(\\s|$)`, "gi"), "$1 $2$3");

  return out.trim();
}

// Healthcheck
app.get("/", (_req, res) => res.send("OK"));

app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body.message || "").toString().slice(0, 1000);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300, // ~4 Sätze
      messages: [
        {
          role: "system",
          content: `Du bist Wisy, ein Beratungsassistent für PDB Aesthetic Room (PDB).
ANTWORTE IMMER IN MAXIMAL VIER SÄTZEN. Schreibe nie mehr als vier Sätze.
Antworte auf Deutsch, freundlich und professionell.

Wenn der Nutzer nach konkreten Behandlungen oder Preisen fragt,
nutze vorrangig diese Liste:
${treatments.map(t => `• ${t.name}: ${t.preis} € – ${t.beschreibung}`).join("\n")}

Falls die gewünschte Behandlung hier nicht aufgeführt ist,
gib allgemeine, hilfreiche Informationen (z. B. typische Möglichkeiten/Tipps)
und lade den Nutzer ein, über folgenden Link Kontakt aufzunehmen:
${CONTACT_URL}

Wichtig:
– Schreibe den Hinweis auf das Kontaktformular immer nur EINMAL,
  direkt als klickbaren Link im Format [Kontaktformular](URL),
  und schreibe nicht zusätzlich davor oder danach noch einmal
  das Wort „Kontaktformular“.
– Erfinde niemals eine andere E-Mail-Adresse oder Telefonnummer.
– Verwende niemals den Satz „Ich habe keine Informationen“.`
        },
        { role: "user", content: userMessage },
      ],
    });

    const raw =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldigung, ich habe dich nicht verstanden.";

    const reply = forceMarkdownLink(raw);

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Abrufen der KI-Antwort");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
