/*************************************************
 * WISY CHAT – PDB AESTHETIC ROOM (ULTIMATE 3D)
 * Feature: Floating Avatar + Hint Bubble (No Auto-Popup)
 *************************************************/

const WISY_SESSION_KEY = "wisySessionId";
const AVATAR_URL = "https://cdn.shopify.com/s/files/1/0629/0826/8791/files/IMG_6687.png?v=1770909900";
const WISY_CHAT_ENDPOINT = "https://chatbot-backend-clean-eord.onrender.com/api/wisy/chat";
const WISY_EVENT_ENDPOINT = "https://chatbot-backend-clean-eord.onrender.com/api/wisy/events";
const WISY_CONTACT_ENDPOINT = "https://chatbot-backend-clean-eord.onrender.com/api/wisy/contact";
const WISY_WARMUP_ENDPOINT = "https://chatbot-backend-clean-eord.onrender.com/";
const WISY_CONTACT_CONSENT_VERSION = "wisy-contact-v2-2026-09-12";
let wisyVolatileSessionId = null;
let wisyRequestInFlight = false;
let wisyWarmupStarted = false;

// 1. CSS FÜR DESIGN & ANIMATION
var wisyStyleTag = document.createElement('style');
wisyStyleTag.innerHTML = `

  #wisy-toggle {
    background: transparent !important;
    width: 100px !important;
    height: 120px !important;
    border: none !important;
    box-shadow: none !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    cursor: pointer !important;
    position: fixed !important;
    bottom: 15px !important;
    right: 15px !important;
    z-index: 2147483646 !important;
    transition: all 0.3s ease !important;
    -webkit-tap-highlight-color: transparent;
  }

  #wisy-toggle img {
    width: 100% !important;
    height: auto !important;
    filter: drop-shadow(0 10px 15px rgba(0,0,0,0.3)) !important;
    animation: wisy-float 3s ease-in-out infinite !important;
  }

  /* Die dezente Sprechblase */
  .wisy-hint {
    position: absolute;
    top: -10px;
    right: 90px;
    background: white;
    padding: 10px 18px;
    border-radius: 18px 18px 2px 18px;
    box-shadow: 0 5px 20px rgba(0,0,0,0.15);
    font-family: 'Assistant', sans-serif;
    font-size: 14px;
    font-weight: 500;
    color: #333;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(10px) scale(0.9);
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    pointer-events: none;
    border: 1px solid #d4af37;
  }

  .wisy-hint.show {
    opacity: 1;
    transform: translateY(0) scale(1);
  }

  /* Schwebende Animation */
  @keyframes wisy-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }

  #wisy-toggle:hover img {
    transform: scale(1.05);
    filter: drop-shadow(0 15px 20px rgba(0,0,0,0.4)) !important;
  }

  #wisy-widget {
    z-index: 2147483647 !important;
  }

  #wisy-compliance-note {
    padding: 8px 14px 7px;
    border-bottom: 1px solid #f0ede6;
    background: #fffaf2;
    color: #5d5548;
    font-family: 'Assistant', sans-serif;
    font-size: 11px;
    line-height: 1.35;
    text-align: center;
  }

  .wisy-msg.typing {
  display: flex;
  gap: 4px;
  padding: 10px 15px !important;
  width: fit-content;
}

.dot {
  width: 6px;
  height: 6px;
  background: #d4af37; /* Dein Gold-Ton */
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.dot:nth-child(2) { animation-delay: 0.2s; }
.dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { transform: scale(0); opacity: 0.3; }
  40% { transform: scale(1); opacity: 1; }
}

/* Basis-Design (Desktop) */
  .wisy-service-container {
    margin-top: 15px;
    margin-bottom: 15px;
    border-top: 1px solid #f0ede6;
    padding-top: 10px;
  }

  .wisy-service-title {
    font-weight: 800;
    font-size: 14px;
    color: #333;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .wisy-service-card {
    padding: 16px;
    border: 1px solid #f0ede6;
    border-left: 4px solid #d4af37;
    background: #fff;
    border-radius: 4px;
  }

  .wisy-service-link {
    display: block;
    color: #d4af37;
    text-decoration: none;
    font-weight: bold;
    font-size: 12px;
    text-align: center;
  }

  .wisy-contact-form {
    margin: 12px 8px 18px;
    padding: 14px;
    border: 1px solid #e7dccf;
    border-left: 4px solid #d4af37;
    border-radius: 10px;
    background: #fffaf2;
    color: #333;
    font-family: 'Assistant', sans-serif;
  }

  .wisy-contact-form h3 { margin: 0 0 5px; font-size: 15px; }
  .wisy-contact-form p { margin: 0 0 10px; font-size: 12px; line-height: 1.4; }
  .wisy-contact-form label { display: block; margin: 8px 0 3px; font-size: 12px; font-weight: 700; }
  .wisy-contact-form input[type="text"],
  .wisy-contact-form input[type="email"],
  .wisy-contact-form input[type="tel"],
  .wisy-contact-form select {
    width: 100%;
    min-height: 38px;
    padding: 8px 10px;
    border: 1px solid #d8cec5;
    border-radius: 7px;
    background: #fff;
    color: #211d1a;
    font: inherit;
  }
  .wisy-contact-form select { appearance: auto; }
  #wisy-contact-cta {
    width: calc(100% - 24px);
    min-height: 56px;
    margin: 8px 12px;
    padding: 9px 12px;
    border: 1px solid #d4af37;
    border-radius: 8px;
    background: #fffaf2;
    color: #29221e;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 3px;
    font-family: 'Assistant', sans-serif;
    text-align: left;
    cursor: pointer;
  }
  #wisy-contact-cta span { font-size: 13px; font-weight: 800; letter-spacing: .02em; }
  #wisy-contact-cta small { color: #795a45; font-size: 12px; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
  #wisy-contact-cta:hover { background: #f8efdf; }
  #wisy-contact-cta:focus-visible,
  .wisy-contact-submit:focus-visible,
  .wisy-contact-form input:focus-visible,
  .wisy-contact-form select:focus-visible { outline: 2px solid #9d775c; outline-offset: 2px; }
  #wisy-contact-cta.is-submitted { cursor: default; background: #f4f1ec; color: #5d5548; }
  .wisy-contact-consent { display: flex !important; gap: 8px; align-items: flex-start; font-weight: 400 !important; line-height: 1.35; }
  .wisy-contact-consent input { margin-top: 3px; flex: 0 0 auto; }
  .wisy-contact-consent a { color: #795a45; }
  .wisy-contact-submit {
    width: 100%;
    margin-top: 10px;
    padding: 10px 12px;
    border: 0;
    border-radius: 7px;
    background: #29221e;
    color: #fff;
    font-weight: 700;
    cursor: pointer;
  }
  .wisy-contact-submit:disabled { cursor: wait; opacity: .65; }
  .wisy-contact-status { min-height: 18px; margin-top: 8px !important; color: #7a3028; }

  /* --- HIER WIRD ES AUF DEM HANDY KLEINER --- */
  @media (max-width: 480px) {
    #wisy-toggle {
      width: 72px !important;
      height: 86px !important;
      bottom: 12px !important;
      right: 10px !important;
    }
    #wisy-toggle img {
      max-width: 72px !important;
    }
    .wisy-hint {
      right: 62px;
      top: 2px;
      padding: 8px 12px;
      font-size: 12px;
    }

    .wisy-service-container {
      margin-top: 8px;
      padding-top: 5px;
    }
    .wisy-service-title {
      font-size: 12px; /* Kleinerer Titel */
      margin-bottom: 5px;
    }
    .wisy-service-card {
      padding: 8px 12px; /* Viel flacher auf dem Handy! */
    }
    .wisy-service-link {
      font-size: 11px; /* Kompakterer Text */
    }
  }

  @media (max-height: 700px), (max-width: 480px) {
    #wisy-widget {
      top: 10px !important;
      bottom: 10px !important;
      height: calc(100dvh - 20px) !important;
      max-height: calc(100dvh - 20px) !important;
    }
    #wisy-compliance-note { padding: 6px 12px; font-size: 10px; }
  }

  @media (max-width: 360px) {
    #wisy-toggle {
      width: 64px !important;
      height: 78px !important;
      bottom: 10px !important;
      right: 8px !important;
    }
    #wisy-toggle img {
      max-width: 64px !important;
    }
    .wisy-hint {
      right: 56px;
    }
  }

`;


document.head.appendChild(wisyStyleTag);


function initWisy() {
  const widget   = document.getElementById("wisy-widget");
  const openBtn  = document.getElementById("wisy-toggle");
  const closeBtn = document.getElementById("closeChatBtn");
  const messages = document.getElementById("wisy-messages");
  const input    = document.getElementById("wisy-input");
  const sendBtn  = document.getElementById("wisy-send");
  const contactCta = document.getElementById("wisy-contact-cta");

  if (!widget || !openBtn || !closeBtn || !messages || !input || !sendBtn || !contactCta) {
  setTimeout(initWisy, 150);
  return;
}


  // HTML Struktur für den Avatar & die Sprechblase
  openBtn.innerHTML = `
    <div id="wisy-hint-bubble" class="wisy-hint">Wünschen Sie Beratung? ✨</div>
    <img src="${AVATAR_URL}" alt="Wisy Avatar">
  `;

  const hint = document.getElementById("wisy-hint-bubble");

  function createSessionId() {
    return (typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  }

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(WISY_SESSION_KEY);
      if (!id) {
        id = createSessionId();
        sessionStorage.setItem(WISY_SESSION_KEY, id);
      }
      return id;
    } catch (err) {
      if (!wisyVolatileSessionId) wisyVolatileSessionId = createSessionId();
      return wisyVolatileSessionId;
    }
  }

  function clearSessionId() {
    wisyVolatileSessionId = null;
    try {
      sessionStorage.removeItem(WISY_SESSION_KEY);
      localStorage.removeItem(WISY_SESSION_KEY);
    } catch (err) {}
  }

  function trackCtaClick(target) {
    fetch(WISY_EVENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), target }),
      keepalive: true
    }).catch(() => {});
  }

  function warmUpWisy() {
    if (wisyWarmupStarted) return;
    wisyWarmupStarted = true;
    fetch(WISY_WARMUP_ENDPOINT, {
      method: "GET",
      cache: "no-store"
    }).catch(() => {});
  }

  function contactField(form, labelText, name, type, autocomplete, required = false) {
    const label = document.createElement("label");
    label.htmlFor = `wisy-contact-${name}`;
    label.textContent = labelText;
    const field = document.createElement("input");
    field.id = `wisy-contact-${name}`;
    field.name = name;
    field.type = type;
    field.autocomplete = autocomplete;
    field.maxLength = name === "phone" ? 40 : name === "email" ? 320 : 160;
    field.required = required;
    form.appendChild(label);
    form.appendChild(field);
    return field;
  }

  function contactSelect(form, labelText, name, options, value = "") {
    const label = document.createElement("label");
    label.htmlFor = `wisy-contact-${name}`;
    label.textContent = labelText;
    const select = document.createElement("select");
    select.id = `wisy-contact-${name}`;
    select.name = name;
    select.required = true;
    options.forEach((option) => {
      const item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      item.selected = option.value === value;
      select.appendChild(item);
    });
    form.appendChild(label);
    form.appendChild(select);
    return select;
  }

  function topicForIntent(intent) {
    if (intent === "booking" || intent === "contact") return "appointment_consultation";
    if (intent === "treatment") return "treatment_selection";
    if (intent === "price") return "pricing_offer";
    return "";
  }

  function showContactForm(suggestedTopic = "") {
    const existing = messages.querySelector(".wisy-contact-form");
    if (existing) {
      messages.scrollTop = Math.max(0, existing.offsetTop - messages.offsetTop - 8);
      existing.querySelector("select")?.focus({ preventScroll: true });
      return;
    }

    const form = document.createElement("form");
    form.className = "wisy-contact-form";
    form.noValidate = true;

    const title = document.createElement("h3");
    title.textContent = "Persönlichen Kontakt anfragen";
    const intro = document.createElement("p");
    intro.textContent = "Wählen Sie Ihr Anliegen und wie wir Sie persönlich erreichen dürfen. Bitte geben Sie keine Gesundheitsdaten ein.";
    form.appendChild(title);
    form.appendChild(intro);

    const topic = contactSelect(form, "Anliegen *", "topic", [
      { value: "", label: "Bitte auswählen" },
      { value: "appointment_consultation", label: "Termin / Beratung" },
      { value: "treatment_selection", label: "Beratung zur Behandlungsauswahl" },
      { value: "pricing_offer", label: "Preis / Angebot" },
      { value: "callback", label: "Rückruf" },
      { value: "other", label: "Sonstiges" }
    ], suggestedTopic);
    const preferredMethod = contactSelect(form, "Bevorzugter Kontaktweg *", "method", [
      { value: "", label: "Bitte auswählen" },
      { value: "email", label: "E-Mail" },
      { value: "phone", label: "Telefon" },
      { value: "either", label: "E-Mail oder Telefon" }
    ]);
    const name = contactField(form, "Name *", "name", "text", "name", true);
    const email = contactField(form, "E-Mail", "email", "email", "email");
    const phone = contactField(form, "Telefon", "phone", "tel", "tel");

    const website = document.createElement("input");
    website.type = "text";
    website.name = "website";
    website.tabIndex = -1;
    website.autocomplete = "off";
    website.hidden = true;
    form.appendChild(website);

    const consentLabel = document.createElement("label");
    consentLabel.className = "wisy-contact-consent";
    const consent = document.createElement("input");
    consent.type = "checkbox";
    consent.required = true;
    const consentText = document.createElement("span");
    consentText.appendChild(document.createTextNode("Ich stimme zu, dass PDB Aesthetic Room Name, Anliegen, gewählten Kontaktweg und Kontaktdaten für diese persönliche Anfrage speichert und mich über den gewählten Weg kontaktiert. Diese Zustimmung kann ich jederzeit für die Zukunft widerrufen. "));
    const privacyLink = document.createElement("a");
    privacyLink.href = "https://palaisdebeaute.de/policies/privacy-policy";
    privacyLink.target = "_blank";
    privacyLink.rel = "noopener noreferrer";
    privacyLink.textContent = "Datenschutzhinweise";
    consentText.appendChild(privacyLink);
    consentLabel.appendChild(consent);
    consentLabel.appendChild(consentText);
    form.appendChild(consentLabel);

    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "wisy-contact-submit";
    submit.textContent = "Kontaktanfrage senden";
    const status = document.createElement("p");
    status.className = "wisy-contact-status";
    status.setAttribute("role", "status");
    form.appendChild(submit);
    form.appendChild(status);

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const contactName = name.value.trim();
      const contactEmail = email.value.trim();
      const contactPhone = phone.value.trim();
      const contactTopic = topic.value;
      const contactMethod = preferredMethod.value;
      const missingSelectedMethod = (contactMethod === "email" && !contactEmail)
        || (contactMethod === "phone" && !contactPhone);
      if (!contactTopic || !contactMethod || !contactName || (!contactEmail && !contactPhone) || missingSelectedMethod || !consent.checked) {
        status.textContent = "Bitte Anliegen, Kontaktweg, Name, passende Kontaktdaten und Zustimmung vollständig ausfüllen.";
        return;
      }

      submit.disabled = true;
      status.textContent = "Kontaktanfrage wird sicher übermittelt …";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch(WISY_CONTACT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: getSessionId(),
            consent_to_contact: true,
            consent_version: WISY_CONTACT_CONSENT_VERSION,
            contact_topic: contactTopic,
            preferred_contact_method: contactMethod,
            website: website.value,
            contact: { name: contactName, email: contactEmail, phone: contactPhone }
          }),
          signal: controller.signal
        });
        if (!response.ok) throw new Error(`contact_http_${response.status}`);
        form.remove();
        contactCta.disabled = true;
        contactCta.classList.add("is-submitted");
        contactCta.querySelector("span").textContent = "Kontaktanfrage gesendet";
        contactCta.querySelector("small").textContent = "PDB Aesthetic Room meldet sich persönlich";
        addMessage("Vielen Dank. Ihre Kontaktanfrage ist sicher eingegangen. PDB Aesthetic Room meldet sich persönlich bei Ihnen.", "bot");
      } catch (err) {
        status.textContent = "Die Übermittlung hat nicht funktioniert. Bitte versuchen Sie es erneut oder nutzen Sie das Kontaktformular auf der Website.";
        submit.disabled = false;
      } finally {
        clearTimeout(timeout);
      }
    });

    messages.appendChild(form);
    requestAnimationFrame(() => {
      messages.scrollTop = Math.max(0, form.offsetTop - messages.offsetTop - 8);
      topic.focus({ preventScroll: true });
    });
  }

function appendPlainText(parent, text) {
  parent.appendChild(document.createTextNode(String(text || "")));
}

function getSafeHttpsUrl(rawUrl) {
  try {
    const normalized = String(rawUrl || "")
      .trim()
      .replace(/[),.!?;:]+$/g, "");
    const parsed = new URL(normalized);
    const allowedHost = parsed.hostname === "palaisdebeaute.de"
      || parsed.hostname === "www.palaisdebeaute.de";
    return parsed.protocol === "https:" && allowedHost ? parsed.href : null;
  } catch (err) {
    return null;
  }
}

function appendBotContent(parent, text) {
  const cleanText = String(text || "")
    .replace(/(Details & Buchung|Details|Buchung|Hier klicken):?/gi, "");
  const serviceRegex = /([A-ZÄÖÜ][^.!?\n]*?)\s*(https:\/\/[^\s]+)/g;
  let cursor = 0;
  let match;

  while ((match = serviceRegex.exec(cleanText)) !== null) {
    appendPlainText(parent, cleanText.slice(cursor, match.index));

    const safeUrl = getSafeHttpsUrl(match[2]);
    if (!safeUrl) {
      appendPlainText(parent, match[0]);
      cursor = serviceRegex.lastIndex;
      continue;
    }

    const container = document.createElement("div");
    container.className = "wisy-service-container";

    const title = document.createElement("div");
    title.className = "wisy-service-title";
    title.textContent = match[1].trim();

    const card = document.createElement("div");
    card.className = "wisy-service-card";

    const link = document.createElement("a");
    link.href = safeUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "wisy-service-link";
    link.textContent = new URL(safeUrl).pathname === "/pages/contact"
      ? "KONTAKT AUFNEHMEN ➔"
      : "DETAILS & RESERVIERUNG ➔";
    link.addEventListener("click", () => trackCtaClick(safeUrl));

    card.appendChild(link);
    container.appendChild(title);
    container.appendChild(card);
    parent.appendChild(container);
    cursor = serviceRegex.lastIndex;
  }

  appendPlainText(parent, cleanText.slice(cursor));
}

function addMessage(text, role = "bot", data = null) {
  const el = document.createElement("div");
  el.className = "wisy-msg " + role;

  if (role === "bot") {
    appendBotContent(el, text);
  }
   else {
    el.textContent = text;
  }

  // 2. Button-Logik (Korrektur der doppelten Nachricht)
  if (data && data.buttons) {
    const btnWrap = document.createElement("div");
    btnWrap.style.marginTop = "10px";
    data.buttons.forEach(b => {
      const bEl = document.createElement("button");
      bEl.className = "wisy-quick-btn";
      bEl.style.display = "block";
      bEl.style.width = "100%";
      bEl.style.marginBottom = "5px";
      bEl.textContent = b.label;
      bEl.onclick = (e) => {
        e.stopPropagation();
        addMessage(b.label, "user"); // Zeige nur das edle Label im Chat
        if (b.value === "__WISY_CONTACT__") {
          showContactForm();
        } else {
          sendToServer(b.value, false); // Sende den Befehl 'silent' im Hintergrund
        }
        btnWrap.remove(); // Buttons nach Klick wegräumen
      };
      btnWrap.appendChild(bEl);
    });
    el.appendChild(btnWrap);
  }

// Die Nachricht wird dem Chat hinzugefügt
  messages.appendChild(el);

  // NEU: Sanft zum ANFANG der neuen Nachricht scrollen, statt zum Ende
  setTimeout(() => {
    if (!messages.querySelector(".wisy-contact-form")) {
      el.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, 50);
}

async function sendToServer(text, showInChat = true) {
  const normalizedText = String(text || "").trim().slice(0, 600);
  if (!normalizedText || wisyRequestInFlight) return;

  wisyRequestInFlight = true;
  input.disabled = true;
  sendBtn.disabled = true;

  // Nachricht nur anzeigen, wenn showInChat auf true steht (z.B. beim Tippen)
  if (showInChat) {
    addMessage(normalizedText, "user");
  }

  input.value = "";

  const typingEl = document.createElement("div");
  typingEl.className = "wisy-msg bot typing";
  typingEl.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
  messages.appendChild(typingEl);
  messages.scrollTop = messages.scrollHeight;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(WISY_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: getSessionId(), query: normalizedText }),
      signal: controller.signal
    });

    if (!response.ok) throw new Error(`chat_http_${response.status}`);
    const result = await response.json();

    if (result.reply) {
      addMessage(result.reply, "bot", result);
      const asksAboutCost = /preis|kosten|kostet|kostenlos|gratis|umsonst|gebühr|anrechn|angerechn|verrechn|gutschreib/.test(normalizedText.toLowerCase());
      if (!asksAboutCost && (result.lead_intent === "contact" || result.lead_intent === "booking")) {
        showContactForm(topicForIntent(result.lead_intent));
      }
    } else {
      throw new Error("chat_reply_missing");
    }
  } catch (err) {
    addMessage(
      "Wisy ist gerade nicht erreichbar. Bitte versuchen Sie es erneut oder nutzen Sie unser Kontaktformular.",
      "bot"
    );
  } finally {
    clearTimeout(timeout);
    if (typingEl.parentNode) messages.removeChild(typingEl);
    wisyRequestInFlight = false;
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

function showGreeting() {
  if (messages.children.length > 0) return;
  addMessage(
    "PDB Aesthetic Room ✨\n\nZeit für Perfektion. Womit beginnen wir?",
    "bot",
    {
      buttons: [
        { label: "✨ Hautverjüngung & Glow", value: "Welche Gesichtsbehandlungen bietet ihr an?" },
        { label: "⚡ Schmerzfreie Haarentfernung", value: "Erzähl mir mehr über die dauerhafte Haarentfernung" },
        { label: "🗓️ Kostenfreie Hautanalyse reservieren", value: "Ich möchte einen Termin für eine Beratung" },
        { label: "💉 Faltenunterspritzung & Lippen", value: "Erzähl mir mehr über Unterspritzungen" },
        { label: "☎️ Persönlichen Kontakt anfragen", value: "__WISY_CONTACT__" },
      ]
    }
  );
}

// --- INTERAKTION & EVENT-LISTENER ---

setTimeout(() => {
  if (widget && widget.style.display !== "flex") {
    hint.classList.add("show");
    setTimeout(() => hint.classList.remove("show"), 6000);
  }
}, 4000);
function openWisyChat() {
  warmUpWisy();
  widget.style.display = "flex";
  openBtn.style.display = "none";
  showGreeting();
}

function closeWisyChat() {
  clearSessionId();
  widget.style.display = "none";
  openBtn.style.display = "flex";
}

openBtn.addEventListener("click", function (e) {
  e.preventDefault();
  openWisyChat();
});

closeBtn.addEventListener("click", function (e) {
  e.preventDefault();
  closeWisyChat();
});

contactCta.addEventListener("click", function () {
  if (!contactCta.disabled) showContactForm();
});

document.addEventListener("click", function(e) {
  var clickedOpen = e.target.closest("#wisy-toggle");
  var clickedClose = e.target.closest("#closeChatBtn");

  if (clickedOpen) {
    e.preventDefault();
    openWisyChat();
  }

  if (clickedClose) {
    e.preventDefault();
    closeWisyChat();
  }
}, true);


// 'true' sorgt dafür, dass getippte Nachrichten im Chat sichtbar bleiben
sendBtn.onclick = () => sendToServer(input.value.trim(), true);
input.onkeydown = (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendToServer(input.value.trim(), true);
  }
};
}
initWisy();
