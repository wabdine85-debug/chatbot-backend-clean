# Known Issues

Aktuelle technische Schulden und offene Punkte nach dem Audit vom
11. September 2026.

## Kritisch / Hoch

### Wisy fehlt in der aktuellen Datenschutzerklaerung

Der am 11. September 2026 erneut gelesene Live-Text unter
`/policies/privacy-policy` enthaelt keinen auffindbaren Abschnitt zu Wisy,
OpenAI, n8n, der pseudonymen Session-ID oder dem anonymen Intent-/CTA-Tracking.
Das Live-Widget weist inzwischen auf die Verarbeitung ueber n8n und OpenAI,
den Ausschluss sensibler Gesundheitsdaten und die Datenschutzhinweise hin.
Dieser Hinweis ersetzt keine vollstaendige Datenschutzinformation.

**Pflicht:** Bis Transparenz, Rechtsgrundlage, Empfaenger, Aufbewahrung und
Betroffenenrechte fachlich beziehungsweise rechtlich geprueft und im Live-Text
abgebildet sind, duerfen Wisy-Sessions nicht still mit externen
Kontaktformularen oder Buchungen verknuepft werden. Die direkte Wisy-
Kontaktanfrage verwendet eine sichtbare, versionierte Kontaktfreigabe; ihre
finale fachliche beziehungsweise rechtliche Bewertung bleibt dennoch offen.
Eine rechtliche Konformitaet wird damit nicht behauptet.

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

## Mittel

### Kataloge sind noch nicht eine einzige Datenquelle

Treatment-Daten existieren in `treatments.json`, im n8n-Katalog und koennen
durch `pdb-treatments-export/index.mjs` aus Shopify exportiert werden. Ein
Audit-Skript erkennt Abweichungen, synchronisiert die Quellen aber bewusst
nicht automatisch. Zwei Produktzuordnungen sind weiterhin uneindeutig und
wurden nicht geraten.

### Funnel endet derzeit beim anonymen CTA-Klick

Intent-Kategorien und erlaubte CTA-Klicks werden erfasst. Eine identifizierbare
Kontaktanfrage, Buchungsbeginn und tatsaechliche Buchung werden noch nicht
durchgaengig zur selben Wisy-Session zurueckgemeldet. Ohne diese Anbindung kann
das Dashboard Interesse messen, aber keinen vollstaendigen Umsatz-Funnel.

**Empfohlen nach Datenschutzpruefung:** Kontakt- und Buchungsereignisse nur mit
einer klaren Information fuer Kundinnen und Kunden, dokumentierter
Rechtsgrundlage und datensparsamer Zuordnung ergaenzen. Freie Chattexte und
Gesundheitsangaben bleiben ausgeschlossen.

**Nicht empfohlen:** Kontaktformular-Daten ohne sichtbaren Hinweis oder
Einwilligungs-/Rechtsgrundlagenkonzept automatisch einer Wisy-Session zuordnen.

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
