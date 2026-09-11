# Deployment

Deployment-Dokumentation fuer den vorhandenen Projektstand.

## Aktueller Stand

Der produktive Backend-Service ist `chatbot-backend-clean` auf Render. Eine
Render-Konfigurationsdatei wurde im Repository nicht gefunden.

Nicht gefunden:

- `render.yaml`
- `render.yml`

Gefunden:

- hartcodierte Render-URL in `public/js/wisy.js`
- lokale Vercel-Projektdatei `.vercel/project.json`

## Render

Aus dem vorhandenen Frontend-Skript:

```txt
https://chatbot-backend-clean-eord.onrender.com/api/chat/match
```

Der genaue Render-Build-Befehl ist nicht im Repository dokumentiert.

Wahrscheinlicher Startbefehl aus `package.json`:

```sh
npm start
```

Dieser fuehrt aus:

```sh
node server.js
```

Dies ist aus `package.json` belegt.

## Environment-Variablen

Im Hauptprojekt benoetigte Variablen laut gefundenem Code:

- `OPENAI_API_KEY`
- `DATABASE_URL`
- `DATABASE_SSL`
- `WISY_N8N_WEBHOOK_URL`
- `WISY_N8N_WEBHOOK_SECRET`
- `WISY_N8N_SHARED_SECRET`
- `WISY_ADMIN_PASSWORD` (optional; aktiviert `/wisy-admin`, mindestens 20 Zeichen)

Optional oder im Code referenziert:

- `PORT`
- `NODE_ENV`
- `DEBUG`

Die Phase-1-Routen werden nur aktiviert, wenn die
zugehoerigen `WISY_*` Werte serverseitig gesetzt sind. Vor ihrer Aktivierung
wurden Datenbankmigration, n8n Header-Authentifizierung und Shopify-Umschaltung
als gemeinsamer, rueckrollbarer Go-live durchgefuehrt.

Die drei `WISY_*` Variablen sind im produktiven Render-Service gesetzt; ihre
Werte werden nicht dokumentiert.

## Vercel

Es existiert:

- `.vercel/project.json`

Die Datei verweist auf eine lokale Vercel-Projektverknuepfung. Eine produktive Vercel-Nutzung ist im Repository nicht dokumentiert.

## n8n Deployment

`wisy.json` ist ein n8n-Workflow-Export.

Nicht dokumentiert:

- n8n-Instanz-URL
- Import-/Export-Prozess
- Aktivierungsprozess
- Staging-Workflow
- Credential-Konfiguration
- Webhook-Produktiv-URL

Bekannt aus `wisy.json`:

- Workflow ist als `active: true` markiert.
- Webhook-Pfad ist `wisy`.
- OpenAI Credential-Referenz ist im Workflow vorhanden, konkrete Secret-Werte nicht.

## Datenbank

Nicht dokumentiert:

- Datenbankanbieter
- Schema
- Migrationen
- Backup-Prozess
- Zugriffskonzept

Im Code referenzierte Tabellen:

- `chat_sessions`
- `wisy_chat_sessions`

## Deployment-Checkliste fuer zukuenftige Aenderungen

Vor Deployment:

- Klarstellen, welche Route produktiv genutzt wird.
- Keine Secrets im Code oder in Dokumentation.
- `node --check server.js` ausfuehren, falls Code geaendert wurde.
- Relevante Chat-Flows testen.
- Kontaktformular-Link testen.
- Keine direkte Gmail-Adresse in Antworten.
- Keine erfundenen Preise oder Leistungen.
- n8n Switch-Reihenfolge pruefen, falls `wisy.json` betroffen ist.
- `CHANGELOG.md` aktualisieren.

Nach Deployment:

- `GET /` pruefen.
- `GET /whoami` pruefen, sofern sicher und gewuenscht.
- `POST /api/chat/match` mit Kontakt-, Beratungs- und Treatment-Beispielen pruefen.
- Vor Aenderungen an `/api/chat/session` pruefen, ob diese Endpunkte produktiven Traffic erhalten.
- Frontend-Chat im eingebundenen Kontext pruefen.
- Fehlerlogs pruefen.

## Offene Deployment-Fragen

- Gibt es ein Staging?
- Welche Datenbank ist produktiv?
- Wie werden die produktiven Render-Variablen regelmaessig rotiert?
- Wie werden `treatments.json` und n8n `katalog` synchron gehalten?
- Werden `chat_sessions` oder `wisy_chat_sessions` produktiv benoetigt?
- Welche Retention gilt fuer gespeicherte Chatverlaeufe?
