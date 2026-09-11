# Known Issues

Bekannte Risiken, technische Schulden und offene Punkte auf Basis des vorhandenen Projektstands.

## Kritisch / Hoch

### `/chat` wirkt leseseitig wartungs- bzw. legacy-verdaechtig

In `server.js` greift die Route `/chat` auf `matches` zu. In der gelesenen Route wurde keine vorherige Berechnung von `matches` gefunden.

Wichtige Einordnung:

- Der aktiv genutzte Chatbot auf der Website funktioniert laut Rueckmeldung des Projektinhabers.
- Das vorhandene Frontend-Skript `public/js/wisy.js` zeigt auf `/api/chat/match`, nicht auf `/chat`.
- Das Risiko betrifft nach aktuellem Stand vor allem Lesbarkeit, Wartbarkeit und moegliche alte Test-/Legacy-Pfade.
- `test-wisy.sh` zeigt aktuell auf `/chat`.

### Mehrere Chat-Routen existieren parallel

Vorhanden:

- `/chat_old`
- `/chat`
- `/api/chat/match`

Das Frontend-Skript zeigt auf `/api/chat/match`. Laut Projektinhaber wird der Chatbot bereits aktiv auf der Website genutzt und funktioniert. Nicht vollstaendig dokumentiert ist, ob `/chat` oder `/chat_old` noch irgendwo produktiv oder historisch verwendet werden.

### Frontend und Tests verwenden unterschiedliche Endpunkte

Gefunden:

- `public/js/wisy.js` nutzt Render `/api/chat/match`.
- `test-wisy.sh` nutzt Render `/chat`.
- `wisy-test.html` nutzt lokal `/api/chat`, diese Route wurde in `server.js` nicht gefunden.

### Keine dokumentierte Render-Konfiguration

Eine Datei `render.yaml` oder `render.yml` wurde nicht gefunden.

Render wird ueber hartcodierte URLs referenziert, aber der Deployment-Prozess ist nicht im Repository dokumentiert.

## Mittel

### Doppelte Kataloglogik

Treatment-/Kataloginformationen existieren an mehreren Stellen:

- `treatments.json`
- `treatments_backup.json`
- eingebettet im n8n `katalog` Tool in `wisy.json`
- moeglich generiert durch `pdb-treatments-export/index.mjs`

Risiko:

- Inhalte laufen auseinander.
- Bot-Antworten koennen je nach Kanal unterschiedlich werden.

### Zwei Datenbankzugriffsmuster

Gefunden:

- eigener Postgres-Pool direkt in `server.js`
- exportierter Pool in `db.js`

Risiko:

- uneinheitliche SSL- und Verbindungslogik
- schwerere Wartbarkeit

### Unterschiedliche Session-Tabellen

Gefunden:

- `chat_sessions`
- `wisy_chat_sessions`

Das Schema und die beabsichtigte Nutzung sind nicht dokumentiert.

### Chat-Session-Endpunkte koennen komplette Verlaeufe speichern

In `server.js` existieren:

- `POST /api/chat/session`
- `GET /api/chat/session/:session_id`
- `DELETE /api/chat/session/:session_id`

Der aktuelle lokale Frontend-Pfad `public/js/wisy.js` referenziert diese Endpunkte nicht; das Live-Shopify-Widget sendet direkt an n8n. Eine produktive Nutzung der Session-Endpunkte wurde im Projekt nicht gefunden.

Risiko:

- `POST /api/chat/session` kann komplette Chatverlaeufe in `chat_sessions` speichern.
- Authentifizierung, Retention-Frist und Datenloeschkonzept sind nicht dokumentiert.
- Wenn Nutzer freiwillig sensible Angaben eingeben, koennen diese in gespeicherten Nachrichten landen.

Empfehlung:

- Vor Deaktivierung oder Aenderung Render-/Traffic-Logs pruefen.
- Wenn ungenutzt: Session-Endpunkte entfernen oder hinter Auth/Feature-Flag legen.
- Wenn genutzt: Retention, Loeschlogik und Datenschutzhinweise dokumentieren.

### Offenes CORS

`server.js` nutzt `cors()` ohne dokumentierte Origin-Einschraenkung.

Ob das bewusst fuer Shopify/Embedding notwendig ist, ist nicht dokumentiert.

### HTML-Rendering im Frontend

`public/js/wisy.js` rendert Chat-Inhalte ueber `innerHTML`.

Risiko:

- erhoehte Vorsicht bei ungeprueften Antwortinhalten
- bei AI-Antworten muss besonders auf kontrolliertes HTML geachtet werden

### n8n Switch-Reihenfolge ist fachlich kritisch

Die Email-Regel muss vor der Adresse-Regel stehen. Andernfalls kann `email adresse` als Adressanfrage erkannt werden.

## Niedrig / Ordnung

### Kein automatisiertes Testsetup in `package.json`

`package.json` enthaelt nur:

- `start`

Kein `test`, `lint` oder `check` Script ist dokumentiert.

### Keine dokumentierte Node-Version

Nicht vorhanden:

- `.nvmrc`
- `.node-version`
- `engines` in `package.json`

### Ungewoehnliche Dateien im Repository

Gefunden:

- `-H`
- `-d`

Beide wurden als leere Dateien gesehen. Herkunft und Zweck sind nicht dokumentiert.

### Lokale/metadatenartige Dateien

Gefunden:

- `.vercel/project.json`
- `.DS_Store` im Unterprojekt

Ob diese bewusst versioniert sind, ist nicht dokumentiert.

## Produkt- und AI-Risiken

### Halluzinierte Leistungen oder Preise

Geschaeftsregel:

- keine Preise oder Leistungen erfinden
- bei fehlenden Informationen Kontaktformular empfehlen

Risiko besteht besonders bei AI-Agent- oder Prompt-Aenderungen.

### Inkonsistente Markenstimme

Geschaeftsregel:

- Studio immer `PDB Aesthetic Room`
- niemals `Palais de Beaute` in Bot-Antworten
- luxurioes, kompetent, klar, zielfuehrend

### Conversion-Verlust durch unklare Antworten

Wisy soll Besucher zur naechsten Handlung fuehren. Lange, unklare oder rein informative Antworten koennen Conversion reduzieren.
