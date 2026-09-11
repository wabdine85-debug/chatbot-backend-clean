# Changelog

Alle relevanten Aenderungen an diesem Projekt sollen hier dokumentiert werden.

Das Format orientiert sich grob an Keep a Changelog. Historische Aenderungen werden nicht erfunden.

## Unreleased

### Documentation

- Datenschutzarmes Datenmodell fuer strukturiertes Wisy-Lead-Tracking unter
  `docs/WISY_LEAD_TRACKING.md` dokumentiert. Die zugehoerige additive Migration
  wurde auf die produktive Datenbank angewendet; die neuen Tabellen waren
  danach leer.
- Projektbasis-Dokumentation erstellt:
  - `AGENTS.md`
  - `README.md`
  - `ARCHITECTURE.md`
  - `KNOWN_ISSUES.md`
  - `TESTING.md`
  - `DEPLOYMENT.md`
  - `DECISIONS.md`
  - `PRODUCT_STRATEGY.md`
  - `AI_BEHAVIOR.md`
  - `CONVERSION_STRATEGY.md`
  - `ROADMAP.md`
  - `CHANGELOG.md`
- Dokumentation zur `/chat`-Route praezisiert: Der Website-Chat funktioniert laut Projektinhaber aktiv; das gelesene Risiko betrifft `/chat` als wartungs- bzw. legacy-verdaechtigen Pfad, waehrend das vorhandene Frontend auf `/api/chat/match` zeigt.

### Changed

- Serverseitige, datensparsame Intent-Protokollierung in den vorbereiteten
  Wisy-Proxy integriert. Gespeichert werden nur feste Kategorien wie
  `booking`, `contact` oder `price`, niemals der freie Nachrichtentext.
- Lead-Speicherfehler vom Chatpfad entkoppelt, damit ein Datenbankproblem die
  Antwort an Kundinnen und Kunden nicht unterbricht.
- Lokale Shopify-Widget-Arbeitskopie auf den vorbereiteten Render-Proxy
  umgestellt und mit 600-Zeichen-Limit, Zeitlimit, Doppelsende-Schutz sowie
  einer sichtbaren Fehlerantwort abgesichert. Es erfolgte kein Shopify-Push.
- Serverseitigen Wisy-Chat-Proxy lokal vorbereitet. Er validiert Eingaben,
  begrenzt Anfragen pro IP, setzt einen nur serverseitig vorhandenen
  Auth-Header fuer n8n und reicht nur das erwartete Antwortformat weiter.
- Proxy-Konfiguration auf HTTPS-Webhooks unter `n8n.cloud` und mindestens 32
  Zeichen lange Secrets begrenzt. Ohne gueltige Konfiguration wird die Route
  nicht aktiviert.
- Produktionsabhaengigkeiten sicherheitsorientiert aktualisiert: direkte
  `body-parser`-Abhaengigkeit entfernt, Express auf `5.2.1` aktualisiert und
  die im Express-Router verwendete verwundbare transitive
  `path-to-regexp`-Version `8.3.0` auf `8.4.2` begrenzt.
- Testskript auf echte Dateien unter `test/*.test.js` begrenzt, damit das alte
  manuelle `gpt-test.js` keinen externen OpenAI-Aufruf waehrend Unit-Tests
  versucht.
- Express-App fuer lokale Tests exportiert; im `test`-Modus startet kein
  eigenstaendiger Netzwerk-Listener und `.env` wird nicht geladen.
- Geschuetzten internen Endpunkt `POST /api/internal/wisy/lead-events` lokal
  vorbereitet. Der Endpunkt akzeptiert nur strukturierte Funnel-Ereignisse,
  lehnt freie Chattexte ab und verlangt vor Kontaktdaten eine ausdrueckliche
  Einwilligung.
- JSON-Request-Limit des Express-Backends auf `16kb` gesetzt.
- `.gitignore` bereinigt und um `.env.*` sowie `.DS_Store` erweitert; die
  wertfreie `.env.example` bleibt ausdruecklich versionierbar.
- Migration fuer `wisy_leads` und
  `wisy_lead_events` hinzugefuegt. Das Modell speichert keine freien
  Chatnachrichten und erzwingt eine Einwilligung, bevor Kontaktdaten abgelegt
  werden koennen.
- Migration am 10. September 2026 auf der produktiven Datenbank angewendet;
  beide neuen Tabellen wurden leer angelegt, bestehende Tabellen blieben
  unveraendert.
- Inaktiven n8n-Workflow `wisy-v2-secure-staging` mit separater Webhook-Route
  und expliziter Regel gegen erfundene oder geschaetzte Preise angelegt. Der
  aktive Workflow `wisy` blieb unveraendert.
- Den Webhook des inaktiven Workflows `wisy-v2-secure-staging` mit einem
  eigenen n8n-Header-Auth-Credential abgesichert. Der Secret-Wert wurde direkt
  aus dem macOS-Schluesselbund uebertragen und nicht ausgegeben oder in einer
  Projektdatei gespeichert.
- n8n Workflow `wisy` aktualisiert:
  - `session_id` Mapping im AI-Pfad repariert, damit `Simple Memory` den vom Webhook gesendeten `session_id` Wert nutzen kann.
  - Beratung-Switch-Regel erweitert, damit sie `body.query` und `body.message` beruecksichtigt.
  - Kuendigung-/Tippfehler-Varianten werden vor dem AI-Fallback zum Kontaktpfad geroutet.
- n8n Antwortlogik fuer Sales-/Q&A-Faelle erweitert:
  - Fragen zu Unterspritzungen beruecksichtigen jetzt Botox/Faltenunterspritzung mit Botulinum und Hyaluron Filler.
  - Beratungsanfragen zeigen jetzt beide Wege: professionelle Hautanalyse & Beratung zur Selbstterminierung und Kontaktformular.
  - Fragen zu `10%`, Rabattcode, Rabatt oder Newsletter werden auf die Newsletter-Anmeldung als Ursprung des 10% Rabattcodes geroutet, ohne einen Code zu erfinden.
- n8n Beratung-/Hautanalyse-Routing praezisiert:
  - Hautanalyse- und Beratungsausloeser werden per Regex auf den festen Beratungs-CTA geroutet.
  - Der feste Beratungs-CTA zeigt die Hautanalyse-Selbstterminierung und das Kontaktformular.
- AI-Stilregel ergaenzt:
  - Direkte Sie-Ansprache bevorzugen.
  - Formulierungen wie `man erwirbt` vermeiden.
- Statische n8n-Kontaktantwort auf hoefliche Sie-Ansprache umgestellt.
- `session_id` Mapping in statischen Kontakt- und Beratungsantworten robuster gemacht, damit `session_id` und `sessionId` akzeptiert werden.
- n8n Live-Fehler aus den letzten Executions korrigiert:
  - Exosomen-Tippfehler wie `exodomen` und `exodomentheraphie` werden auf einen festen Exosomen-Pfad geroutet.
  - Preisfragen werden auf eine sichere Rueckfrage mit Hautanalyse- und Kontakt-CTA geroutet.
  - Gesichtsbehandlungsfragen werden mit einer kurzen festen Auswahl beantwortet.
  - Falscher CTA `Beratung zur Mitgliedschaft anfragen` wird bei Nicht-Mitgliedschaftsfragen verhindert.
- n8n Gutschein-Intent-Logik ergaenzt:
  - `Gutschein` wird als mehrdeutig behandelt und klaert zwischen Newsletter-Rabattcode und Geschenkgutschein.
  - Geschenkgutschein-Kaufabsichten werden auf den dokumentierten Geschenkgutschein-Link geroutet.
  - `Gutscheincode`, `10%` und Rabattfragen bleiben in der Newsletter-/Rabattlogik.
- n8n AI-Agent-Prompt um medizinische Sicherheitsregel erweitert:
  - Bei sensiblen Gesundheitsdaten oder medizinischen Details keine Diagnose, keine medizinische Bewertung und keine Behandlungsempfehlung allein aus Nutzerangaben.
  - Wisy soll in solchen Faellen zur persoenlichen Beratung bzw. bei medizinischen Fragen zur aerztlichen Abklaerung fuehren.
- Shopify-Wisy-Widget datenschutzfreundlicher gemacht:
  - Session-ID wird im Live-Widget nicht mehr dauerhaft per `localStorage`, sondern nur noch tabbezogen per `sessionStorage` gespeichert.
  - Beim Schliessen des Widgets wird die Session-ID entfernt.
- Shopify-Datenschutzerklaerung live um Abschnitt `KI-Chat-Assistent Wisy` erweitert:
  - Verarbeitung ueber n8n/OpenAI, Session-ID per `sessionStorage`, Hinweis auf keine sensiblen Gesundheitsdaten und Kontaktformular-Alternative dokumentiert.
- Datenschutzrelevante Debug-Logs reduziert:
  - Backend loggt in `/api/chat/match` keine freien Nutzereingaben mehr.
  - Backend loggt keine gekuerzten AI-Antwortinhalte mehr.
  - Altes Frontend-Script loggt keine freien Nutzereingaben oder Session-IDs mehr in der Browser-Konsole.
- Session-Endpunkte datenschutzseitig dokumentiert:
  - `POST /api/chat/session`, `GET /api/chat/session/:session_id` und `DELETE /api/chat/session/:session_id` als potenzielle Speicherpfade fuer komplette Chatverlaeufe markiert.
  - Aktive Nutzung dieser Endpunkte wurde im gelesenen Frontend und im Shopify-Widget nicht gefunden.
- `treatments.json` um dokumentierte Exosomen-Tippfehler aus Live-Executions erweitert.
- Lokale `wisy.json` mit der Live-n8n-Version synchronisiert.
- `TESTING.md` um einen Wisy Q&A Regressionstest fuer zentrale Kundenfragen erweitert.
- `AI_BEHAVIOR.md` um Regeln fuer Unterspritzungen, Beratung/Hautanalyse und Newsletter/10% Rabatt erweitert.
- `AI_BEHAVIOR.md` um medizinische Sicherheitsregel fuer sensible Gesundheitsdaten erweitert.

### Verified

- Backend-Syntaxchecks und 14 automatisierte Tests fuer Validierung,
  Authentifizierung, Transaktion, Intent-Klassifizierung, Fehlerentkopplung,
  Rate-Limit und Health-Endpunkt bestanden.
- Syntax und sicherheitsrelevante Merkmale der lokalen Shopify-Widget-Datei
  geprueft. Ein Browserlauf war nicht moeglich, da Playwright lokal nicht
  installiert ist; es wurde keine neue Testabhaengigkeit hinzugefuegt.
- Isolierten n8n-Staging-Test ausgefuehrt: Request ohne Header wurde mit HTTP
  403 abgelehnt, Request mit Header mit HTTP 200 beantwortet und die Session-ID
  beibehalten. Der Staging-Workflow wurde danach erfolgreich deaktiviert.
- n8n Webhook-Test fuer `E Mail`, `Beratung`, `Kuendigung`, `Kundogung`, `Erzaehl mir mehr ueber Unterspritzungen` und `10%` ausgefuehrt.
- n8n Webhook-Test fuer `Ich moechte Beratung`, `Hautanalyse buchen` und `Wie bekomme ich den Rabattcode?` ausgefuehrt.
- n8n Regressionstest fuer `Hautanalyse buchen`, `Ich brauche Beratung`, `E Mail`, `email adresse`, `Wie bekomme ich 10% Rabatt?` und `Erzaehl mir mehr ueber Unterspritzungen` ausgefuehrt.
- n8n Regressionstest fuer `E Mail`, `email adresse`, `Kontakt`, `Kuendigung` und `Hautanalyse buchen` nach Anpassung der Sie-Ansprache ausgefuehrt.
- n8n Live-Regressionstest fuer `Welches Geraet bei exodomentheraphie`, `Welches Geraet bri exodomen`, `Wie teuer ist 1 behandlung`, `Welche Gesichtsbehandlungen bietet ihr an?`, `Wo finde ich die Newsletter Anmeldung` und `email adresse` ausgefuehrt.
- n8n Live-Regressionstest fuer `Gutschein`, `Ich moechte einen Geschenkgutschein kaufen`, `Ich suche ein Geschenk zum Geburtstag`, `10% Rabatt`, `Gutscheincode` und `email adresse` ausgefuehrt.
- n8n Live-Regressionstest fuer medizinische Sicherheitsregel, Unterspritzungen, Beratung, Gutschein, `10% Rabatt` und `email adresse` ausgefuehrt.
- Neue AI-Executions zeigen `session_id` im `Edit Fields` Node nicht mehr als `null`.

### Notes

- Die Dokumentation basiert auf dem vorhandenen Projektstand und den im Auftrag festgelegten Produkt- und Geschaeftsregeln.
- Die drei benoetigten Wisy-Variablen wurden im Render-Service
  `chatbot-backend-clean` mit `Save only` hinterlegt; es wurde kein Deploy
  ausgeloest und kein Variablenwert dokumentiert.
