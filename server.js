import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json()); 

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// einfacher Test-Endpunkt
app.get("/", (_req, res) => res.send("OK"));

app.post("/chat", async (req, res) => {
  try {
    const userMessage = (req.body.message || "").toString().slice(0, 1000);

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 120,
      messages: [
        {
          role: "system",
          content: `Du bist Wisy, ein Beratungsassistent für PDB Aesthetic Room (kurz: PDB).
Antworte stets freundlich, professionell und in maximal zwei Sätzen.
Wenn der Nutzer nach E-Mail, Kontakt oder Termin fragt,
gib IMMER folgenden Markdown-Link aus:
[Kontaktformular](https://www.palaisdebeaute.de/pages/contact)
Erfinde niemals eine andere E-Mail-Adresse oder Telefonnummer.`,

        },
        { role: "user", content: userMessage },
      ],
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "Entschuldigung, ich habe dich nicht verstanden.";

    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Abrufen der KI-Antwort");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
