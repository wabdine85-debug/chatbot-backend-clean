# Known Issues

Aktuelle technische Schulden und offene Punkte nach dem Audit vom
11. September 2026.

## Kritisch / Hoch

### Mehrere historische Chat-Routen

In `server.js` existieren neben dem produktiven Proxy weiterhin:

- `/chat_old`
- `/chat`
- `/api/chat/match`

Das Shopify-Live-Widget verwendet `/api/wisy/chat`. Ob die drei historischen
Routen noch extern genutzt werden, ist nicht durch Traffic-Daten belegt. Vor
einer Entfernung muessen Render-Logs oder Aufrufer geprueft werden.

### Ungeschuetzte Speicherung kompletter Chatverlaeufe

Die Endpunkte `POST`, `GET` und `DELETE /api/chat/session` beziehungsweise
`/api/chat/session/:session_id` koennen komplette Nachrichten in
`chat_sessions` speichern oder ausgeben. Authentifizierung, Retention und eine
aktive produktive Nutzung sind nicht dokumentiert. Das gelesene lokale und das
Shopify-Frontend referenzieren diese Endpunkte nicht.

### Lead-Dashboard noch deaktiviert

Die datensparsame Ansicht `/wisy-admin` ist implementiert, bleibt aber ohne ein
separates `WISY_ADMIN_PASSWORD` deaktiviert. Die aktuelle Sitzung hat keinen
verfuegbaren Render-Verwaltungszugriff, um diese Variable sicher zu setzen.

## Mittel

### Kataloge sind noch nicht eine einzige Datenquelle

Treatment-Daten existieren in `treatments.json`, im n8n-Katalog und koennen
durch `pdb-treatments-export/index.mjs` aus Shopify exportiert werden. Ein
Audit-Skript erkennt Abweichungen, synchronisiert die Quellen aber bewusst
nicht automatisch. Zwei Produktzuordnungen sind weiterhin uneindeutig und
wurden nicht geraten.

### Lokaler n8n-Export ist dem Live-Workflow voraus

Eindeutig veraltete Produktlinks und redundante Einzelpreise sind im lokalen
`wisy.json` korrigiert. Der aktive n8n-Workflow wurde in dieser Sitzung mangels
n8n-Werkzeug nicht aktualisiert. Bei der spaeteren Uebernahme muss insbesondere
die Email-Regel vor der Adresse-Regel bleiben.

### Funnel endet derzeit beim anonymen CTA-Klick

Intent-Kategorien und erlaubte CTA-Klicks werden erfasst. Eine identifizierbare
Kontaktanfrage, Buchungsbeginn und tatsaechliche Buchung werden noch nicht
durchgaengig zur selben Wisy-Session zurueckgemeldet. Ohne diese Anbindung kann
das Dashboard Interesse messen, aber keinen vollstaendigen Umsatz-Funnel.

### Offenes globales CORS

`server.js` verwendet global `cors()`. Der oeffentliche CTA-Endpunkt validiert
die Storefront-Origin zusaetzlich serverseitig und das Dashboard entfernt den
CORS-Header. Fuer historische Routen ist die benoetigte Origin-Menge noch nicht
dokumentiert.

### Lokales Frontend rendert weiterhin HTML

`public/js/wisy.js` verwendet fuer Teile der Chatdarstellung `innerHTML`. Das
produktive Shopify-Widget baut Bot-Inhalte dagegen mit DOM-Methoden auf und
begrenzt anklickbare Links auf die offiziellen PDB-Domains. Das lokale Frontend
sollte vor einer erneuten produktiven Verwendung entsprechend gehaertet werden.

## Niedrig / Betrieb

### Keine festgelegte Node-Version

Es gibt noch keine `.nvmrc`, `.node-version` oder `engines`-Angabe in
`package.json`.

### Keine Render-Konfiguration im Repository

Der produktive Service `chatbot-backend-clean` wird im Render-Dashboard
konfiguriert. Eine `render.yaml` oder `render.yml` ist nicht vorhanden; Build,
Start und Secret-Rotation sind deshalb nur teilweise reproduzierbar.

### Automatische Aufbewahrungsloeschung fehlt

Eine 90-Tage-Frist fuer inaktive anonyme Leads ist dokumentiert, aber noch
nicht als geplanter Job umgesetzt. Die konkrete Frist muss mit
Datenschutzerklaerung und betrieblichem Loeschkonzept uebereinstimmen.
