// ===============================
// 💬 Wisy Chat – FINAL EDITION (mit klickbaren Links + sanftem Fade-Out)
// ===============================

const STORAGE_KEY = "wisyChatHistory:v2";
const SESSION_KEY = "wisySessionId";
const CHAT_ENDPOINT = "https://chatbot-backend-clean-eord.onrender.com/chat";


// --- DOM ---
const chatWrapper = document.getElementById("chatWrapper");
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const clearBtn = document.getElementById("clearChat");
const closeChatBtn = document.getElementById("closeChatBtn");

let chatHistory = [];

// 🔥 Session wird IMMER vom Backend vergeben
let sessionId = localStorage.getItem(SESSION_KEY) || null;


/* ------------------------- UI ------------------------- */
function addMessageToUI({ text, role }) {
  const el = document.createElement("div");
  el.className =
    role === "user" ? "msg user" : role === "system" ? "sys" : "msg bot";

  // 🔹 Server liefert bereits fertiges HTML → direkt rendern
  el.innerHTML = text || "";

  chatContainer.appendChild(el);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

/* ------------------------- Speicher ------------------------- */
function safeSaveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
}

function safeLoadLocal() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/* ------------------------- Server Sync ------------------------- */
async function loadFromServer() {
  try {
    const res = await fetch(`/api/chat/session/${sessionId}`);
    if (!res.ok) throw new Error("Server-Fehler beim Laden");
    const data = await res.json();
    chatHistory = data.messages || [];
    console.log("📂 Verlauf aus DB geladen:", chatHistory);
    chatHistory.forEach(m => addMessageToUI(m));
  } catch (err) {
    console.warn("⚠️ Konnte Verlauf nicht vom Server laden:", err);
    chatHistory = safeLoadLocal();
    chatHistory.forEach(m => addMessageToUI(m));
  }
}

async function saveToServer() {
  try {
    await fetch("/api/chat/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, messages: chatHistory })
    });
  } catch (err) {
    console.warn("⚠️ Speichern auf Server fehlgeschlagen:", err);
  }
}
/* ------------------------- Wisy Input Processing ------------------------- */

// 1️⃣ Text normalisieren
function normalizeInput(text) {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^\w\s]/g, "")
    .trim();
}

// 2️⃣ Synonyme & Tippfehler
const synonymMap = {
  "unreine haut": ["unrein", "pickel", "pikel", "mitesser"],
  "akne": ["akne", "acne", "ackne"],
  "trockene haut": ["trocken", "trockne", "spannt", "schuppig"],
  "fahle haut": ["fahl", "grau", "mued"],
  "feine linien": ["linien", "faeltchen", "faelte"]
};

// 3️⃣ Tags extrahieren
function extractTags(text) {
  const found = [];

  for (const [tag, variations] of Object.entries(synonymMap)) {
    for (const v of variations) {
      if (text.includes(v)) {
        found.push(tag);
        break;
      }
    }
  }

  return found;
}

/* ------------------------- Nachrichtenlogik ------------------------- */
function addMessage({ text, role }) {
  chatHistory.push({ text, role });
  addMessageToUI({ text, role });
  safeSaveLocal();
  saveToServer();
}

async function sendToServer(userText, tags = []) {
  console.log("📤 Sende an Server:", userText, sessionId);

  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userText,
      tags,
      session_id: sessionId
    })
  });

  const data = await res.json();

  // 🔥 WICHTIG: Session-ID vom Backend übernehmen
  if (data.session_id && data.session_id !== sessionId) {
    sessionId = data.session_id;
    localStorage.setItem(SESSION_KEY, sessionId);
    console.log("🔁 Session-ID vom Backend übernommen:", sessionId);
  }

  return data.reply || "Keine Antwort erhalten.";
}



/* ------------------------- Chat schließen ------------------------- */
if (closeChatBtn) {
  closeChatBtn.addEventListener("click", async () => {
    if (!confirm("Chat schließen und Verlauf löschen?")) return;

    // Verlauf löschen (lokal + DB)
    chatHistory = [];
    localStorage.removeItem(STORAGE_KEY);
    await saveToServer();

    // UI leeren
    if (chatContainer) chatContainer.innerHTML = "";

    // Info kurz anzeigen
    const info = document.createElement("div");
    info.className = "sys";
    info.textContent = "💬 Chat wurde beendet. Starte ein neues Gespräch!";
    chatContainer.appendChild(info);

    // Sanft ausblenden
    chatWrapper.classList.add("hidden");
    setTimeout(() => {
      chatWrapper.style.display = "none";
    }, 300);
  });
}

/* ------------------------- Initialisierung ------------------------- */
async function init() {
  console.log("🚀 Initialisierung gestartet...");

  await loadFromServer();

  if (chatHistory.length === 0) {
    addMessage({ role: "system", text: "👋 Willkommen! Dein Chat wird sicher gespeichert." });
  }

  chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const rawText = chatInput.value.trim();
  if (!rawText) return;

  // 🔹 Schritt 3: Normalisieren + Schreibfehler erkennen
  const normalizedText = normalizeInput(rawText);
  const wisyTags = extractTags(normalizedText);

  // 🔹 User-Nachricht anzeigen (Originaltext bleibt sichtbar)
  addMessage({
    role: "user",
    text: rawText,
    tags: wisyTags // wird später für Empfehlungen genutzt
  });

  chatInput.value = "";


    const thinking = { role: "assistant", text: "…" };
    addMessage(thinking);

    try {
      const reply = await sendToServer(rawText, wisyTags);

      chatHistory.pop();
      chatContainer.lastElementChild.remove();
      addMessage({ role: "assistant", text: reply });
    } catch (err) {
      chatHistory.pop();
      chatContainer.lastElementChild.remove();
      addMessage({ role: "assistant", text: "⚠️ Fehler beim Abrufen der Antwort." });
    }
  });

  clearBtn.addEventListener("click", async () => {
    if (!confirm("Verlauf wirklich löschen?")) return;
    chatHistory = [];
    safeSaveLocal();
    await saveToServer();
    chatContainer.innerHTML = "";
    addMessage({ role: "system", text: "🧹 Verlauf gelöscht." });
  });

  window.addEventListener("beforeunload", () => {
    safeSaveLocal();
    saveToServer();
  });
}

document.addEventListener("DOMContentLoaded", init);
