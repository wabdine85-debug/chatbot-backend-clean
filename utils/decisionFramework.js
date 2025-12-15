// utils/decisionFramework.js

export const DECISION_AXES = {
  fett: {
    question: "Was ist dir bei deinem Körperziel wichtiger?",
    options: [
      { key: "muskel", text: "Muskelaufbau & Straffung" },
      { key: "fettreduktion", text: "Gezielte Reduktion von Fettdepots" },
      { key: "entwaesserung", text: "Entlastung & Lymphfluss" }
    ]
  },

  falten: {
    question: "Welche Art von Veränderung stört dich mehr?",
    options: [
      { key: "mimik", text: "Mimikfalten (z. B. Stirn, Zornesfalte)" },
      { key: "volumen", text: "Volumenverlust / eingefallene Bereiche" },
      { key: "erschlaffung", text: "Nachlassende Hautspannung" }
    ]
  },

  hautstruktur: {
    question: "Was möchtest du an deiner Haut verbessern?",
    options: [
      { key: "poren", text: "Poren & Hautbild" },
      { key: "narben", text: "Narben & Unebenheiten" },
      { key: "glow", text: "Frische & Glow" }
    ]
  },

  haarentfernung: {
    question: "Welche Region möchtest du behandeln?",
    options: [
      { key: "gesicht", text: "Gesicht" },
      { key: "ruecken", text: "Rücken" },
      { key: "beine", text: "Beine" },
      { key: "klein", text: "Kleine Zonen" }
    ]
  }
};
