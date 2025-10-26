// ===============================
// Wisy Chat – stabile LocalStorage-Version mit Logs
// ===============================
const STORAGE_KEY = "wisyChatHistory:v1";
const CHAT_ENDPOINT = "/chat";

// --- DOM ---
const chatContainer = document.getElementById("chatContainer");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const clearBtn = document.getElementById("clearChat");

let chatHistory = [];

// --- Helper ---
function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
    console.log("💾 Verlauf gespeichert:", chatHistory);
  } catch (err) {
    console.error("⚠️ Fehler beim Speichern:", err);
  }
}

function loadHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      console.log("📭 Kein gespeicherter Verlauf gefunden.");
      return [];
    }
    const parsed = JSON.parse(data);
    console.log("📂 Verlauf geladen:", parsed);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("⚠️ Fehler beim Laden:", err);
    return [];
  }
}

function addMessageToUI({ text, role }) {
  const el = document.createElement("div");
  el.className = role === "user" ? "msg user" : role === "system" ? "sys" : "msg bot";
  el.textContent = text;
  chatContainer.appendChild(el);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage({ text, role }) {
  chatHistory.push({ text, role });
  addMessageToUI({ text, role });
  saveHistory();
}

async function sendToServer(userText) {
  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userText }),
  });
  const data = await res.json();
  return data.reply || "Keine Antwort erhalten.";
}

// --- Init ---
function init() {
  console.log("🚀 Initialisierung gestartet...");
  chatHistory = loadHistory();

  if (chatHistory.length === 0) {
    addMessage({ role: "system", text: "👋 Willkommen! Dein Chatverlauf wird lokal gespeichert." });
  } else {
    chatHistory.forEach(msg => addMessageToUI(msg));
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage({ role: "user", text });
    chatInput.value = "";

    // Platzhalter anzeigen
    const thinking = { role: "assistant", text: "…" };
    addMessage(thinking);

    try {
      const reply = await sendToServer(text);
      chatHistory.pop(); // Platzhalter entfernen
      chatContainer.lastElementChild.remove();
      addMessage({ role: "assistant", text: reply });
    } catch (err) {
      chatHistory.pop();
      chatContainer.lastElementChild.remove();
      addMessage({ role: "assistant", text: "⚠️ Fehler beim Abrufen der Antwort." });
    }
  });

  clearBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    chatHistory = [];
    chatContainer.innerHTML = "";
    addMessage({ role: "system", text: "🧹 Verlauf gelöscht." });
  });

  // zur Sicherheit beim Schließen speichern
  window.addEventListener("beforeunload", saveHistory);
}

document.addEventListener("DOMContentLoaded", init);
