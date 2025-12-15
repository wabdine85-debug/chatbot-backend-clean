// utils/handleGeneralQuestions.js

import { isGeneralQuestion } from "./generalQuestions.js";

/**
 * Feste, kontrollierte Antworten
 * ChatGPT wird nur genutzt, wenn hier nichts matched
 */
const STATIC_ANSWERS = [
  {
    match: ["hallo", "hi", "hey", "servus", "moin"],
    answer: "Hallo 😊 Wie kann ich dir weiterhelfen?"
  },
  {
    match: [
      "öffnungszeiten",
      "offnungszeiten",
      "geöffnet",
      "geoeffnet",
      "wann habt ihr",
      "wann offen"
    ],
    answer:
      "Wir haben Montag, Dienstag, Donnerstag & Freitag von 10–18 Uhr geöffnet, Samstag von 10–15 Uhr. Mittwoch ist geschlossen."
  },
  {
    match: [
      "adresse",
      "wo seid ihr",
      "standort",
      "anfahrt",
      "wo finde ich euch"
    ],
    answer:
      "Du findest uns in der Rheinstraße 59, 65185 Wiesbaden."
  },
  {
    match: ["parkplatz", "parken", "auto"],
    answer:
      "Parkmöglichkeiten gibt es direkt in der Rheinstraße sowie im Parkhaus Luisenforum."
  },
  {
    match: ["termin", "beratung", "beratungsgespräch"],
    answer:
      "Gerne beraten wir dich persönlich. Termine kannst du bequem online buchen oder eine kostenlose Beratung anfragen."
  },
  {
    match: ["gutschein", "geschenk"],
    answer:
      "Gutscheine sind bei uns sowohl online als auch vor Ort erhältlich – ideal als Geschenk."
  }
];

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export async function handleGeneralQuestions(message, askChatGPT) {
  if (!isGeneralQuestion(message)) return null;

  const msg = normalizeText(message);

  // 1️⃣ Feste Antworten prüfen
  for (const item of STATIC_ANSWERS) {
    if (item.match.some(k => msg.includes(normalizeText(k)))) {
      return item.answer;
    }
  }

  // 2️⃣ ChatGPT als Fallback (kontrolliert)
  return await askChatGPT(message);
}
