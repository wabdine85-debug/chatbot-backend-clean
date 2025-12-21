// ===============================
// 💬 Wisy Chat – FINAL (OPTION A)
// Reload = leer | ❌ löscht | Chat-Button öffnet wieder
// Shopify-safe: bricht sauber ab, wenn DOM nicht vorhanden ist
// ===============================

const CHAT_ENDPOINT = "https://chatbot-backend-clean-eord.onrender.com/api/chat/match";


// ---------------- STATE (NUR RAM) ----------------
let chatHistory = [];
let sessionId = null;

// ---------------- DOM (wird erst in init() gesetzt) ----------------
let chatWrapper, chatContainer, chatForm, chatInput, closeChatBtn, openChatBtn;

// ---------------- UI ----------------
function addMessageToUI({ text, role }) {
  if (!chatContainer) return; // extra safety

  const el = document.createElement("div");
  el.className =
    role === "user" ? "msg user" :
    role === "system" ? "sys" :
    "msg bot";

  el.innerHTML = text || "";
  chatContainer.appendChild(el);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addMessage({ text, role }) {
  chatHistory.push({ text, role });
  addMessageToUI({ text, role });
}

// ---------------- SERVER ----------------
async function sendToServer(userText, tags = []) {
  console.log("📤 Sende:", userText, "session:", sessionId);

  const res = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: userText,
      tags,
      session_id: sessionId
    })
  });

  let data;
  try {
    data = await res.json();
  } catch (e) {
    console.error("❌ JSON parse error", e);
    return "⚠️ Technischer Fehler. Bitte kurz erneut versuchen.";
  }

  if (data.session_id) {
    sessionId = data.session_id; // 🔥 nur im RAM
    console.log("🆕 session_id gesetzt:", sessionId);
  }

  return data;

}

// ---------------- TEXT LOGIK ----------------
function normalizeInput(text) {
  return (text || "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^\w\s]/g, "")
    .trim();
}

const synonymMap = {
  "unreine haut": ["unrein", "pickel", "pikel", "mitesser"],
  "akne": ["akne", "acne", "ackne"],
  "trockene haut": ["trocken", "trockne", "spannt", "schuppig"],
  "fahle haut": ["fahl", "grau", "mued"],
  "feine linien": ["linien", "faeltchen", "faelte"]
};

function extractTags(text) {
  const found = [];
  for (const [tag, list] of Object.entries(synonymMap)) {
    for (const v of list) {
      if (text.includes(v)) {
        found.push(tag);
        break;
      }
    }
  }
  return found;
}

// ---------------- MAIN INIT ----------------
function init() {
  console.log("🚀 Wisy Init – Option A");

  // DOM erst JETZT greifen (Shopify-safe)
  chatWrapper   = document.getElementById("chatWrapper");
  chatContainer = document.getElementById("chatContainer");
  chatForm      = document.getElementById("chatForm");
  chatInput     = document.getElementById("chatInput");
  closeChatBtn  = document.getElementById("closeChatBtn");
  openChatBtn   = document.getElementById("openChatBtn"); // 👈 dein Chatbutton

  // Wenn Chat nicht auf dieser Seite existiert: sauber raus
  if (!chatWrapper || !chatContainer || !chatForm || !chatInput) {
    console.warn("⚠️ Wisy: Chat-DOM nicht gefunden – Script abgebrochen");
    return;
  }

  // Chat startet IMMER neu (Reload = leer)
  chatHistory = [];
  sessionId = null;

  addMessage({
    role: "system",
    text: "👋 Willkommen! Wie kann ich dir helfen?"
  });

  // ---------- SEND ----------
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const rawText = chatInput.value.trim();
    if (!rawText) return;

    const normalized = normalizeInput(rawText);
    const tags = extractTags(normalized);

    addMessage({ role: "user", text: rawText });
    chatInput.value = "";

    // typing indicator
    addMessage({ role: "assistant", text: "…" });

    try {
    const data = await sendToServer(rawText, tags);

// remove thinking
chatHistory.pop();
if (chatContainer.lastElementChild) chatContainer.lastElementChild.remove();

// 1️⃣ Textantwort anzeigen
if (data.reply) {
  addMessage({ role: "assistant", text: data.reply });
}

// 2️⃣ Treatments anzeigen (NEU – Schritt 3)
if (data.treatments && data.treatments.length) {
  data.treatments.forEach(t => {
    addMessage({
      role: "assistant",
      text: `
        <div class="wisy-treatment">
          <div class="wisy-title">${t.label}</div>
          <div class="wisy-summary">${t.summary}</div>
          <a href="${t.url}" target="_blank" class="wisy-btn">
            Mehr erfahren
          </a>
        </div>
      `
    });
  });
  return; // ⛔ wichtig: danach NICHTS mehr rendern
}

// 3️⃣ Fallback-Buttons (falls vorhanden)
if (data.buttons && data.buttons.length) {
  data.buttons.forEach(b => {
    addMessage({
      role: "assistant",
      text: `<button class="wisy-quick-btn" onclick="document.getElementById('chatInput').value='${b.value}';document.getElementById('chatForm').dispatchEvent(new Event('submit'));">
              ${b.label}
            </button>`
    });
  });
}

    } catch (err) {
      console.error("❌ send error", err);

      chatHistory.pop();
      if (chatContainer.lastElementChild) chatContainer.lastElementChild.remove();

      addMessage({ role: "assistant", text: "⚠️ Fehler beim Abrufen der Antwort." });
    }
  });

  // ---------- ❌ CLOSE (Hard reset + hide) ----------
  if (closeChatBtn) {
    closeChatBtn.addEventListener("click", () => {
      if (!confirm("Chat schließen und Verlauf löschen?")) return;

      chatHistory = [];
      sessionId = null;
      chatContainer.innerHTML = "";

      addMessage({
        role: "system",
        text: "💬 Chat beendet. Starte ein neues Gespräch!"
      });

      // Nur per CSS verstecken (nicht display:none)
      chatWrapper.classList.add("hidden");
    });
  }

  // ---------- 💬 OPEN BUTTON ----------
  if (openChatBtn) {
    openChatBtn.addEventListener("click", () => {
      // Beim Öffnen IMMER frische Session + leerer Verlauf (Option A)
      chatHistory = [];
      sessionId = null;
      chatContainer.innerHTML = "";

      chatWrapper.classList.remove("hidden");

      addMessage({
        role: "system",
        text: "👋 Willkommen! Wie kann ich dir helfen?"
      });

      // Fokus in Input
      setTimeout(() => chatInput.focus(), 50);
    });
  }
}

console.log("🚀 wisy.js loaded – calling init()");
init();


