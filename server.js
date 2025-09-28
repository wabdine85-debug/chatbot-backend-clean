import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";

// Behandlungsdaten aus JSON laden
const treatments = JSON.parse(
  fs.readFileSync(new URL("./treatments.json", import.meta.url))
);


dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Healthcheck
app.get("/", (_req, res) => res.send("OK"));

const CONTACT_URL = "https://palaisdebeaute.de/pages/contact";

// Hilfsfunktion: Erzwingt sauberen Markdown-Link
function forceMarkdownLink(text) {
  if (!text) return "";
  // 1) Bereits vorhandenen Markdown-Link auf korrekte URL & Ankertext normalisieren
  const mdExactUrl = new RegExp(`\\[([^\\]]+)\\]\\(${CONTACT_URL.replace(/\//g, "\\/")}\\)`, "g");
  let out = text.replace(mdExactUrl, `[Kontaktformular](${CONTACT_URL})`);

  // 2) Rohe URL -> Markdown-Link
  const rawUrl = new RegExp(CONTACT_URL.replace(/\//g, "\\/"), "g");
  out = out.replace(rawUrl, `[Kontaktformular](${CONTACT_URL})`);

  // 3) Kaputte HTML-Links -> Markdown-Link
  out = out.replace(/<a[^>]*href="https?:\/\/[^"]+"[^>]*>.*?<\/a>/gi, `[Kontaktformular](${CONTACT_URL})`);

  // 4) Satzzeichen direkt nach dem Link von der URL trennen (z. B. ...contact). -> ...contact ).
  out = out.replace(
    new RegExp(`(\\[Kontaktformular\\]\\(${CONTACT_URL.replace(/\//g, "\\/")}\\))([\\.,!\\?])(\\s|$)`, "g"),
    `$1 $2$3`
  );

  return out.trim();
}

app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body.message || "").toString().slice(0, 1000);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,   // ca. 4 Sätze – reicht aus
      messages: [
        {
          role: "system",
          content: `Du bist Wisy, ein Beratungsassistent für PDB Aesthetic Room (PDB).
Antworte immer auf Deutsch, freundlich und professionell.
Wenn es für den Nutzer hilfreich ist, darfst du bis zu vier Sätze schreiben,
um die Behandlung und ihre Vorteile überzeugend zu erklären.

Wenn der Nutzer nach konkreten Behandlungen oder Preisen fragt,
nutze vorrangig diese Liste:
${treatments.map(t => `• ${t.name}: ${t.preis} € – ${t.beschreibung}`).join("\n")}

Falls die gewünschte Behandlung hier nicht aufgeführt ist,
gib bitte stattdessen allgemeine, hilfreiche Informationen
(zum Beispiel typische Behandlungsmöglichkeiten oder Tipps)
und lade den Nutzer ein, über den folgenden Link Kontakt aufzunehmen:
(${CONTACT_URL})

Wichtig:
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
