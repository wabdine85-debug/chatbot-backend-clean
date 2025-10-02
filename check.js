import dotenv from "dotenv";

dotenv.config();

if (process.env.OPENAI_API_KEY) {
  console.log("✅ Key geladen!");
  console.log("Key Anfang:", process.env.OPENAI_API_KEY.slice(0, 15) + 
"...");
} else {
  console.log("❌ Kein API-Key gefunden!");
}

