// utils/decisionRuntime.js
import { DECISION_AXES } from "./decisionFramework.js";

// kleine Normalisierung
const norm = (s = "") =>
  String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function detectIntentFromTagsOrText(tags = [], text = "") {
  const t = norm(text);
  const set = new Set(tags.map(norm));

  if (set.has("haarentfernung") || t.includes("haar") || t.includes("laser")) return "haarentfernung";
  if (set.has("falten") || t.includes("falten") || t.includes("botox") || t.includes("hyaluron")) return "falten";
  if (set.has("akne") || set.has("poren") || set.has("narben") || t.includes("glow") || t.includes("akne") || t.includes("poren")) return "hautstruktur";
  if (set.has("fett") || t.includes("fett") || t.includes("bauch") || t.includes("ems") || t.includes("fettwegspritze")) return "fett";

  return null;
}

export function initDecisionContext(intent, candidates) {
  return {
    active: true,
    intent,
    candidates,              // die 2 Matches aus matchTreatments
    asked: false,            // ob wir schon eine Achsenfrage gestellt haben
    lastTurn: Date.now()
  };
}

export function isShortRefinement(text = "") {
  const w = norm(text).split(/\s+/).filter(Boolean);
  return w.length <= 3; // glow / ruecken / stirn / bauch etc.
}

// sehr gezielte Bonus-Heuristik (funktioniert sofort ohne JSON-Änderungen)
export function refineCandidates(intent, candidates, userText) {
  const input = norm(userText);

  const REGION = ["ruecken","bauch","beine","arme","gesicht","achsel","bikini","intim","brust","nacken","kinn"];
  const regionsHit = REGION.filter(r => input.includes(r));

  const refined = candidates.map(t => {
    let bonus = 0;
    const wisy = t.wisy || {};
    const name = norm(t.treatment || t.name || "");

    // allgemeine: wenn userText Wörter enthält, die in wisy Ziele/Probleme vorkommen
    (wisy.ziele || []).forEach(z => { if (input.includes(norm(z))) bonus += 4; });
    (wisy.probleme || []).forEach(p => { if (input.includes(norm(p))) bonus += 4; });
    (wisy.hauttypen || []).forEach(h => { if (input.includes(norm(h))) bonus += 2; });

    // intent-spezifisch
    if (intent === "haarentfernung") {
      // Region => nicht "kein Match" werden lassen: gibt Bonus an Laser generell
      if (regionsHit.length) bonus += 3;

      // leichte Heuristik: große Flächen -> Alexandrit oft bevorzugt (ohne medizinische Empfehlung)
      if (regionsHit.some(r => ["ruecken","beine","arme","bauch","brust"].includes(r))) {
        if (name.includes("alexand")) bonus += 2;
      }
      // kleinere Zonen -> Diodenlaser kann Bonus bekommen
      if (regionsHit.some(r => ["gesicht","kinn","achsel","bikini","intim"].includes(r))) {
        if (name.includes("diod")) bonus += 2;
      }
    }

    if (intent === "hautstruktur") {
      if (input.includes("glow") && (name.includes("hydra") || name.includes("circadia"))) bonus += 2;
      if (input.includes("narb") && name.includes("morpheus")) bonus += 2;
      if (input.includes("por") && name.includes("hydra")) bonus += 2;
    }

    if (intent === "falten") {
      if ((input.includes("stirn") || input.includes("zorn") || input.includes("mimik")) && name.includes("botox")) bonus += 3;
      if ((input.includes("volumen") || input.includes("lippe") || input.includes("kinn") || input.includes("wange")) && name.includes("hyal")) bonus += 3;
    }

    if (intent === "fett") {
      if ((input.includes("muskel") || input.includes("straff")) && name.includes("ems")) bonus += 3;
      if ((input.includes("lymph") || input.includes("wasser") || input.includes("entwaess")) && name.includes("lymph")) bonus += 3;
      if ((input.includes("depot") || input.includes("fettweg")) && (name.includes("fett") || name.includes("injek"))) bonus += 3;
    }

    return { ...t, score: (t.score || 0) + bonus };
  });

  return refined.sort((a,b) => (b.score || 0) - (a.score || 0));
}

export function getAxisQuestion(intent) {
  const axis = DECISION_AXES[intent];
  if (!axis) return null;
  const options = axis.options.map(o => `– ${o.text}`).join("<br>");
  return `${axis.question}<br><br>${options}`;
}

// =========================
// FIX 1: Achsen-Antworten auswerten (glow, ruecken, stirn etc.)
// =========================
export function mapAxisAnswer(intent, userText) {
  const input = userText.toLowerCase();

  // Hautstruktur
  if (intent === "hautstruktur") {
    if (input.includes("glow")) return "glow";
    if (input.includes("por")) return "poren";
    if (input.includes("narb")) return "narben";
  }

  // Haarentfernung
  if (intent === "haarentfernung") {
    if (input.includes("rück") || input.includes("rueck")) return "ruecken";
    if (input.includes("gesicht")) return "gesicht";
    if (input.includes("bein")) return "beine";
    if (input.includes("klein")) return "klein";
  }

  // Falten
  if (intent === "falten") {
    if (input.includes("stirn") || input.includes("mimik")) return "mimik";
    if (input.includes("volumen")) return "volumen";
    if (input.includes("erschlaff")) return "erschlaffung";
  }

  return null;
}
