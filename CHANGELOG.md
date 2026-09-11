# Changelog

Alle relevanten Aenderungen an diesem Projekt sollen hier dokumentiert werden.

Das Format orientiert sich grob an Keep a Changelog. Historische Aenderungen werden nicht erfunden.

## Unreleased

### Documentation

- Erneuten Live-Abgleich der Shopify-Datenschutzerklaerung dokumentiert: Der
  zuvor protokollierte Wisy-Abschnitt ist im aktuell ausgelieferten Text nicht
  auffindbar. Eine Verknuepfung pseudonymer Wisy-Sessions mit identifizierbaren
  Kontakt- oder Buchungsdaten bleibt deshalb bis zur fachlichen beziehungsweise
  rechtlichen Pruefung ausdruecklich gesperrt.
- Technisches Wisy-Datenschutz-Faktenblatt mit aktivem Datenfluss,
  gespeicherten Feldern, beteiligten Systemen, nicht dokumentierten
  Aufbewahrungsfragen und Pflichtpunkten vor identifizierbarem Lead-Closing
  ergaenzt.

- Reproduzierbaren Katalog-Audit und den am 11. September 2026 festgestellten
  Drift zwischen Backend, n8n und Shopify dokumentiert.
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

- Shopify-Wisy-Widget gegen Render-Free-Plan-Kaltstarts gehaertet: Beim Oeffnen
  wird der oeffentliche Render-Endpunkt einmal ohne Kundeninhalt aufgeweckt und
  das Browser-Zeitlimit fuer die erste Chatanfrage von 20 auf 45 Sekunden
  erhoeht. Die live ausgelieferte Datei und ein Chat-/Kontaktfall wurden danach
  erfolgreich geprueft.
- Passwortgeschuetzte Lead-Ansicht auf Render aktiviert und produktiv auf
  Authentifizierung, Security-Header, Datenstruktur, Kontakt-Einwilligung und
  Ausschluss freier Chattexte geprueft.
- Acht belegte Produktlinks und vier redundant gepflegte Einzelpreise nach
  unveroeffentlichtem Entwurfscheck im aktiven abgesicherten n8n-Workflow
  korrigiert. Entwurf und aktive Version wurden anschliessend strukturell
  verifiziert; fuenf Live-Regressionen ueber den Render-Proxy bestanden.
- Alten ungeschuetzten n8n-Workflow `wisy` nach erneuter Aktivitaetspruefung
  deaktiviert, aber nicht geloescht. Der alte Webhook liefert danach HTTP 404,
  waehrend der geschuetzte Render-Pfad weiterhin HTTP 200 liefert.
- Shopify-Live-Widget nach erfolgreichem Render-Ende-zu-Ende-Test um
  datensparsame CTA-Klickerfassung erweitert; die live heruntergeladene Datei
  wurde bytegenau gegen den geprueften lokalen Stand verifiziert.
- Anklickbare Links im Shopify-Live-Widget auf HTTPS-Ziele der offiziellen
  Domains `palaisdebeaute.de` und `www.palaisdebeaute.de` begrenzt.
- Zwoelf belegte Legacy-/Fehldateien nach bytegenauer Sicherung im externen
  Wisy-Systemarchiv aus dem aktiven Repository entfernt. Darunter waren ein
  Skript mit partieller Secret-Ausgabe, veraltete manuelle Tests, doppelte
  Sicherungen, ungenutzte Session-Hilfen, leere Unfall-Dateien und `.DS_Store`.
- Projekt-, Test-, Architektur- und Betriebsdokumentation an den bereinigten
  Ist-Zustand angepasst.
- Datenschutzarmen, rate-limitierten CTA-Tracking-Endpunkt unter
  `POST /api/wisy/events` vorbereitet. Er akzeptiert nur erlaubte
  Storefront-Origins und HTTPS-Ziele von `palaisdebeaute.de`.
- Lead-Dashboard um CTA-Klicks der letzten sieben Tage und den letzten sicher
  validierten Ziel-Link erweitert.
- Standardmaessig deaktivierte, passwortgeschuetzte Lead-Ansicht unter
  `/wisy-admin` vorbereitet. Sie zeigt nur strukturierte Funnel-Daten, fragt
  keine Chattexte ab, verhindert Caching und blendet Kontaktdaten ohne
  Einwilligung aus.
- Neun eindeutig belegte veraltete Produktlinks in `treatments.json` und acht
  entsprechende Links im lokalen n8n-Export auf aktive Shopify-Produkte
  korrigiert. Vier separat gepflegte Einzelpreise aus dem n8n-Katalog
  entfernt; bestaetigte Premium-Preise blieben erhalten.
- Serverseitige, datensparsame Intent-Protokollierung in den vorbereiteten
  Wisy-Proxy integriert. Gespeichert werden nur feste Kategorien wie
  `booking`, `contact` oder `price`, niemals der freie Nachrichtentext.
- Lead-Speicherfehler vom Chatpfad entkoppelt, damit ein Datenbankproblem die
  Antwort an Kundinnen und Kunden nicht unterbricht.
- Shopify-Live-Widget im Theme `UPDATED PDB V3.3 PREMIUM FINAL` auf den
  geschuetzten Render-Proxy umgestellt und mit 600-Zeichen-Limit, Zeitlimit,
  Doppelsende-Schutz sowie einer sichtbaren Fehlerantwort abgesichert. Die
  vorhandenen Layoutgroessen des Live-Themes blieben unveraendert.
- Bot-Antworten im Shopify-Live-Widget werden ohne dynamisches Roh-HTML
  aufgebaut. Nur validierte HTTPS-Links werden klickbar und externe Links
  erhalten `noopener noreferrer`.
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
- Ungenutzte Vercel-CLI aus den Entwicklungsabhaengigkeiten entfernt. Ihre
  transitive Abhaengigkeitskette verursachte beim Render-Build 24 Audit-Hinweise,
  obwohl sie nicht zur Laufzeit verwendet wurde.
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

- Gesamten Shopify-Produktkatalog mit `read_products` rein lesend gegen die in
  Backend und n8n hinterlegten Produktlinks geprueft. Mehrere veraltete Links
  und drei abweichende Einzelpreise wurden identifiziert; uneindeutige
  Zuordnungen wurden nicht automatisch veraendert.
- Backend-Syntaxchecks und 25 automatisierte Tests fuer Katalog-Audit,
  Validierung, Authentifizierung, Transaktion, Intent-Klassifizierung,
  Fehlerentkopplung, CTA-Datenminimierung, Dashboard-Datenschutz, Rate-Limit
  und Health-Endpunkt bestanden.
- Vollstaendiger `npm audit` nach Entfernung der ungenutzten Vercel-CLI ohne
  bekannte Schwachstellen bestanden; zuvor war bereits der reine
  Produktions-Audit sauber.
- Shopify-Live-Dateien vor der Umschaltung gesichert, nach dem Upload erneut
  aus Theme `200148746504` heruntergeladen und bytegenau mit der geprueften
  Fassung verglichen. Die oeffentliche Storefront liefert den neuen
  Render-Proxy, die sichere DOM-Ausgabe und das 600-Zeichen-Limit aus.
- Isolierter Renderer-Test bestaetigt, dass eingeschleustes HTML nicht
  ausgefuehrt, ein gueltiger HTTPS-Link sicher aufgebaut und ein unsicheres
  URL-Schema nicht verlinkt wird.
- Vollstaendiger Kundenpfad ueber den oeffentlichen Render-Proxy mit HTTP 200,
  vorhandener Antwort und beibehaltener Test-Session verifiziert. Ein
  grafischer Browserlauf war in der Sitzung nicht verfuegbar; es wurde keine
  neue Testabhaengigkeit hinzugefuegt.
- Isolierten n8n-Staging-Test ausgefuehrt: Request ohne Header wurde mit HTTP
  403 abgelehnt, Request mit Header mit HTTP 200 beantwortet und die Session-ID
  beibehalten. Der Staging-Workflow wurde danach erfolgreich deaktiviert.
- Ende-zu-Ende-Test vom produktiven Render-Proxy zum abgesicherten n8n-v2-
  Workflow mit einer anonymen, eindeutig markierten Test-Session bestanden:
  HTTP 200, Antwort vorhanden und Session-ID beibehalten. Der v2-Workflow ist
  danach aktiv geblieben; das Live-Shopify-Widget verwendet weiterhin den
  bisherigen Workflow.
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
  `chatbot-backend-clean` hinterlegt und der Service anschliessend erfolgreich
  live deployt. Kein Variablenwert wurde dokumentiert.
- Die anonyme Test-Session `phase1-e2e-test-20260911` kann nach der finalen
  Datenbankkontrolle aus den Lead-Tabellen entfernt werden; sie enthaelt keine
  Kontakt- oder freien Chatdaten.
