# Architecture

Aktuelle Architektur des vorhandenen Projekts.

## Systemuebersicht

Das Projekt besteht aus mehreren parallelen Komponenten:

- Express-Backend
- statisches Chat-Frontend
- lokaler Treatment-Katalog
- kleine FAQ-Datenbasis
- Postgres-Anbindung
- OpenAI-Anbindung
- n8n-Workflow-Export mit eigenem AI Agent
- Shopify-Export-Unterprojekt

## Backend

Hauptdatei: `server.js`

Aufgaben:

- Express-App erstellen
- CORS aktivieren
- JSON-Body-Parsing aktivieren
- statische Dateien aus `public/` ausliefern
- `treatments.json` lesen
- OpenAI-Client initialisieren
- Postgres-Pool initialisieren
- Chat- und Session-Endpunkte bereitstellen
- Server auf `process.env.PORT` oder Port `3000` starten

## Backend-Routen

In `server.js` vorhanden:

- `GET /`: einfache OK-Antwort.
- `GET /whoami`: Diagnoseinformationen inklusive Treatment-Pfad und Sample.
- `POST /chat_old`: alte Chatlogik.
- `POST /chat`: weitere Chatlogik; beim Lesen wirkt diese Route wegen `matches` ohne sichtbare Definition wartungs- bzw. legacy-verdaechtig. Der aktiv genutzte Website-Chat funktioniert laut Projektinhaber und scheint ueber `/api/chat/match` zu laufen.
- `POST /api/chat/match`: Treatment-Matching-API, vom vorhandenen Frontend genutzt.
- `POST /api/chat/session`: Session speichern.
- `GET /api/chat/session/:session_id`: Session laden.
- `DELETE /api/chat/session/:session_id`: Session loeschen.

## Matching im Backend

`server.js` laedt `treatments.json` beim Start.

Die Funktion `matchTreatments(tags)` bewertet Treffer anhand von:

- `triggers`
- `synonyms`
- `areas`
- `intent`
- `priority`

Die API `/api/chat/match` verarbeitet:

- explizite Kategoriekommandos wie `__CAT__:skin`, `__CAT__:anti`, `__CAT__:hair`, `__CAT__:contact`
- allgemeine Kontakt- oder Beratungsanfragen
- Freitext-Matching gegen `treatments.json`
- Fallback-Buttons fuer Hauptkategorien

## Treatment-Katalog

Datei: `treatments.json`

Gefundene Struktur:

- 31 Eintraege
- Felder: `id`, `name`, `url`, `category`, `priority`, `summary`, `triggers`, `synonyms`, `areas`, `intent`, `bookable`
- alle gelesenen Eintraege hatten `bookable: true`

Die Datenpflege ist nicht dokumentiert.

## FAQ

Datei: `faq.json`

Gefundene Struktur:

- Array
- Felder: `frage`, `antwort`
- vier Eintraege wurden gefunden

Die genaue Pflege- oder Freigabelogik ist nicht dokumentiert.

## Frontend

Dateien:

- `public/wisy.html`
- `public/js/wisy.js`

`public/js/wisy.js`:

- initialisiert den Chat nur, wenn benoetigte DOM-Elemente vorhanden sind
- haelt `chatHistory` und `sessionId` nur im RAM
- extrahiert einfache Tags im Browser
- sendet an eine fest konfigurierte Render-URL
- rendert Antworten und Buttons in den Chat

Aktueller Endpoint:

```txt
https://chatbot-backend-clean-eord.onrender.com/api/chat/match
```

## Datenbank

Dateien:

- `server.js`
- `db.js`
- `wisySessions.js`

Gefundene Tabellenreferenzen:

- `chat_sessions`
- `wisy_chat_sessions`

Das Datenbankschema ist nicht dokumentiert.

Migrationsdateien wurden nicht gefunden.

### Session-Speicherung

`server.js` enthaelt Endpunkte zum Speichern, Laden und Loeschen von Chatverlaeufen in `chat_sessions`.

Im aktuell gelesenen Frontend `public/js/wisy.js` wurde keine Nutzung dieser Session-Endpunkte gefunden; dort wird der Chatverlauf im Browser nur im RAM gehalten und an `/api/chat/match` gesendet. Das Live-Shopify-Widget nutzt n8n direkt und nicht diese Backend-Session-Endpunkte.

Nicht dokumentiert:

- ob `chat_sessions` produktiv benoetigt wird
- Retention-Frist fuer gespeicherte Chatverlaeufe
- Zugriffsschutz fuer Session-Endpunkte
- Datenloeschprozess ausserhalb des vorhandenen `DELETE /api/chat/session/:session_id`

## OpenAI

Im Backend wird ein OpenAI-Client mit `OPENAI_API_KEY` initialisiert.

In der alten Chatlogik wird ein OpenAI-Chat-Completion-Aufruf referenziert.

Die produktive Nutzung im aktuellen Frontend-Pfad `/api/chat/match` basiert sichtbar auf regelbasiertem Matching und nicht auf einem OpenAI-Aufruf.

## n8n Workflow

Datei: `wisy.json`

Gefundene Nodes:

- `Webhook`
- `Switch`
- `Adresse`
- `Oeffnungszeiten`
- `Parken`
- `Respond Adresse`
- `Respond Oeffnungszeiten`
- `Respond Parken`
- `Edit Kontakt`
- `Respond Kontakt`
- `Edit Beratung`
- `Respond Beratung`
- `Respond to Webhook`
- `Edit Fields`
- `AI Agent`
- `Simple Memory`
- `OpenAI Chat Model`
- `katalog`

Der Webhook nutzt Pfad `wisy` und Methode `POST`.

Das OpenAI Chat Model im Workflow nutzt `gpt-4.1-mini`.

Der `katalog` Node ist ein Tool-Code-Node und enthaelt eigene Treatment-/Kataloglogik.

## n8n Switch-Regel

Die Email-Regel im Switch muss vor der Adresse-Regel stehen. Sonst kann `email adresse` faelschlich als Adressanfrage erkannt werden.

## Shopify Export

Unterordner: `pdb-treatments-export`

Dateien:

- `index.mjs`
- `package.json`
- `package-lock.json`

Das Skript ruft Shopify-Produkte ab und schreibt eine `treatments.json` im jeweiligen Ausfuehrungskontext.

Der genaue produktive Datenpflegeprozess ist nicht dokumentiert.

## Aktueller Frontend-Datenfluss

```txt
Besucher
  -> public/js/wisy.js
  -> Render URL /api/chat/match
  -> server.js
  -> treatments.json
  -> JSON-Antwort mit reply und buttons
  -> Chat-UI
```

## Paralleler n8n-Datenfluss

```txt
Webhook /wisy
  -> Switch
  -> feste Antworten oder AI Agent
  -> katalog Tool
  -> Respond to Webhook
```

Ob und wo dieser n8n-Workflow produktiv eingebunden ist, ist im Repository nicht dokumentiert.
