# chatbot-backend

Backend und Projektbasis fuer den Wisy AI Sales Assistant von PDB Aesthetic Room.

## Zweck

Wisy soll Website-Besucher nicht nur beantworten, sondern qualifizieren und zur naechsten passenden Handlung fuehren:

- Beratung anfragen
- Kontaktformular oeffnen
- passende Behandlung ansehen
- Premium-Mitgliedschaft ansehen
- Buchung starten

Hauptziele:

- bessere Antworten
- weniger falsche Antworten
- mehr qualifizierte Leads
- mehr Buchungen
- hoehere Conversion
- konsistente Luxus-Markenstimme
- weniger Halluzinationen
- bessere Wartbarkeit

## Aktueller Projektaufbau

Das Repository enthaelt:

- Express-Backend in `server.js`
- statische Frontend-Dateien unter `public/`
- Treatment-Katalog in `treatments.json`
- FAQ-Daten in `faq.json`
- n8n-Workflow-Export in `wisy.json`
- separates Shopify-Export-Unterprojekt unter `pdb-treatments-export/`
- Hilfsdateien fuer Sessions, Tests und OpenAI-Key-Pruefung

## Voraussetzungen

Nicht vollstaendig dokumentiert.

Aus dem Projekt ersichtlich:

- Node.js
- npm
- lokale `.env` fuer Entwicklung

Eine konkrete Node-Version ist nicht dokumentiert. Es gibt keine `.nvmrc`, `.node-version` oder `engines`-Angabe in `package.json`.

## Installation

```sh
npm install
```

## Start

```sh
npm start
```

Das Startskript fuehrt aus:

```sh
node server.js
```

Der Server nutzt `process.env.PORT` oder faellt auf Port `3000` zurueck.

## Environment-Variablen

Im Hauptprojekt wurden folgende Variablennamen gefunden:

- `OPENAI_API_KEY`
- `DATABASE_URL`
- `DATABASE_SSL`
- `WISY_N8N_WEBHOOK_URL`
- `WISY_N8N_WEBHOOK_SECRET`
- `WISY_N8N_SHARED_SECRET`

Im Unterprojekt `pdb-treatments-export` wurden folgende Variablennamen gefunden:

- `SHOPIFY_SHOP_NAME`
- `SHOPIFY_API_KEY`
- `SHOPIFY_API_PASSWORD`

Konkrete Werte sind nicht dokumentiert und duerfen nicht ausgegeben werden.

Die drei `WISY_*` Variablen gehoeren zur lokal vorbereiteten Phase-1-Architektur.
Ohne gueltige serverseitige Werte bleiben Chat-Proxy und Lead-Endpunkt
deaktiviert. Secrets duerfen nur in den jeweiligen Secret-Stores liegen.

## Wichtige Endpunkte

In `server.js` vorhanden:

- `GET /`
- `GET /whoami`
- `POST /chat_old`
- `POST /chat`
- `POST /api/chat/match`
- `POST /api/chat/session`
- `GET /api/chat/session/:session_id`
- `DELETE /api/chat/session/:session_id`

Der vom vorhandenen Frontend-Skript genutzte produktive Pfad scheint `POST /api/chat/match` auf Render zu sein.

## Frontend

Dateien:

- `public/wisy.html`
- `public/js/wisy.js`

`public/js/wisy.js` sendet aktuell an:

```txt
https://chatbot-backend-clean-eord.onrender.com/api/chat/match
```

Der Chatverlauf wird im Frontend nur im RAM gehalten.

## n8n

`wisy.json` ist ein n8n-Workflow-Export.

Enthalten sind unter anderem:

- Webhook mit Pfad `wisy`
- Switch fuer Standardfragen
- feste Antworten fuer Adresse, Oeffnungszeiten, Parken, Kontakt und Beratung
- AI Agent
- Simple Memory
- OpenAI Chat Model
- Tool-Code-Node `katalog`

Der Workflow enthaelt eigene Kataloglogik. Diese ist nicht automatisch identisch mit `treatments.json`.

## Deployment

Render wird im Projekt ueber hartcodierte Render-URLs referenziert.

Eine Render-Konfigurationsdatei wie `render.yaml` oder `render.yml` wurde im Repository nicht gefunden.

Eine lokale Vercel-Verknuepfung existiert unter `.vercel/project.json`; das ist keine Render-Konfiguration.

## Tests

Ein automatisiertes Testskript ist in `package.json` nicht dokumentiert.

Vorhandene Hilfsdateien:

- `test-wisy.sh`
- `wisy-test.html`
- `gpt-test.js`
- `check.js`

Details siehe `TESTING.md`.

## Dokumentation

Weitere Dokumente:

- `AGENTS.md`
- `ARCHITECTURE.md`
- `AI_BEHAVIOR.md`
- `CONVERSION_STRATEGY.md`
- `DEPLOYMENT.md`
- `DECISIONS.md`
- `KNOWN_ISSUES.md`
- `PRODUCT_STRATEGY.md`
- `ROADMAP.md`
- `TESTING.md`
- `CHANGELOG.md`
