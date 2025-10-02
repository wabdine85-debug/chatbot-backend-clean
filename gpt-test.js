import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const run = async () => {
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Sag Hallo in 3 Wörtern" }],
    });
    console.log("Antwort von GPT:", 
completion.choices[0].message.content);
  } catch (err) {
    console.error("Fehler:", err);
  }
};

run();

