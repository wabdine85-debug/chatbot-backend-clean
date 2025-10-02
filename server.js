/* ---------- /chat ---------- */
app.post("/chat", async (req, res) => {
  console.log("🔥 Neue Version läuft! Chat-Route betreten.");
  const userMessage = (req.body.message || "").toString().slice(0, 300);
  console.log("UserMessage:", userMessage);

  const MAX_TOKENS = 120;
  try {
    const intent = detectIntent(userMessage);

    // 👉 Eigene Antwort bei Begrüßung
    if (intent.isGreet) {
      return res.json({ reply: "Hallo! Wie kann ich Ihnen heute weiterhelfen?" });
    }

    const treatments = loadTreatments();
    const best = smartFindTreatment(userMessage, treatments);

    // 🟢 Debug-Ausgabe ins Log
    console.log("BestMatch:", best ? best.name : "❌ Kein Treffer (GPT-Fallback)");

    // ✅ Direkte Antwort aus JSON, wenn Behandlung erkannt
    if (best) {
      let reply;
      const desc = (best.beschreibung || "").replace(/\s+/g, " ");

      if (intent.isWhat) {
        reply = `${best.name}: ${desc} Preis: ${best.preis}. Mehr Infos hier: ${best.url}`;
      } else if (intent.isPrice) {
        reply = `${best.name}: Preis ${best.preis}. Mehr Infos hier: ${best.url}`;
      } else {
        reply = `${best.name}: ${desc}. Mehr Infos hier: ${best.url}`;
      }

      return res.json({ reply: forceMarkdownLink(reply) });
    }

    // ❌ Wenn keine Behandlung gefunden → GPT fragen
    const SYSTEM_PROMPT =
`Du bist Wisy, der Assistent von PDB Aesthetic Room Wiesbaden.
Antworte immer freundlich, professionell und maximal in 3 Sätzen.
Wenn keine Behandlung passt: lade höflich ein, unser [Kontaktformular](${CONTACT_URL}) zu nutzen.
Keine Telefon/E-Mail angeben.`;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage }
    ];

    const ask = async (model) => client.chat.completions.create({
      model,
      max_completion_tokens: MAX_TOKENS,
      messages
    });

    let completion;
    try {
      completion = await ask("o4-mini");
    } catch (err) {
      if (err?.status === 429) {
        console.warn("429 – fallback auf gpt-5-nano");
        completion = await ask("gpt-5-nano");
      } else {
        throw err;
      }
    }

    const raw = completion.choices?.[0]?.message?.content?.trim()
      || "Entschuldigung, ich habe dich nicht verstanden.";
    const reply = forceMarkdownLink(raw);

    console.log("Antwort von GPT:", reply);

    return res.json({ reply });

  } catch (err) {
    console.error("Fehler im /chat:", err);
    return res.json({
      reply: `Entschuldigung, es gab ein Problem. Bitte nutze unser [Kontaktformular](${CONTACT_URL}).`
    });
  }
});
