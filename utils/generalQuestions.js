// utils/generalQuestions.js

const GENERAL_KEYWORDS = [
  "hallo", "hi", "hey",
  "öffnungszeiten", "uhrzeit", "wann habt ihr",
  "adresse", "wo seid ihr", "wo seid ihr genau", "anfahrt",
  "parken", "parkplatz",
  "termin", "beratung", "kostenlose beratung",
  "gutschein", "geschenk", "geschenkgutschein",
  "kontakt", "telefon", "nummer", "email",
  "was bietet ihr an", "was macht ihr", "leistungen"
];

export function isGeneralQuestion(text = "") {
  const lower = String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return GENERAL_KEYWORDS.some(k =>
    lower.includes(
      k.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    )
  );
}
