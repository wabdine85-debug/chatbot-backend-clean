import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // API-Key bleibt geheim
});

// Endpoint für Chat
app.post("/chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Du bist Wisy, ein Beratungsassistent für PDB Aesthetic Room (kurz: PDB). \
Antworte stets freundlich, professionell und in maximal zwei Sätzen."
 +
            "Du beantwortest Fragen freundlich und leitest Kunden aktiv zur Terminbuchung oder zum Kauf.",
        },
        { role: "user", content: userMessage },
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).send("Fehler beim Abrufen der KI-Antwort");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend läuft auf Port ${PORT}`));
