# Changelog

Alle relevanten Aenderungen an diesem Projekt sollen hier dokumentiert werden.

Das Format orientiert sich grob an Keep a Changelog. Historische Aenderungen werden nicht erfunden.

## Unreleased

### Documentation

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
- Es wurden keine Backend-Codeaenderungen vorgenommen.
- Es wurden keine Frontend-Codeaenderungen vorgenommen.
- Es wurden keine `package.json`-Aenderungen vorgenommen.
- Es wurden keine Render-Aenderungen vorgenommen.
