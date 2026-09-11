# Testing

Testdokumentation fuer das vorhandene Projekt.

## Aktueller Stand

Die automatisierte Testsuite ist in `package.json` dokumentiert:

```json
{
  "test": "node --test test/*.test.js"
}
```

Sie deckt Katalog-Audit, Lead-Validierung und -Transaktion, Chat-Proxy,
CTA-Datenminimierung, Dashboard-Schutz und den Serverstart ab.

## Empfohlener Testablauf vor Aenderungen

Vor jeder Aenderung:

1. Aktuellen Stand analysieren.
2. Betroffene Route oder Datei identifizieren.
3. Pruefen, ob Frontend, Backend oder n8n betroffen sind.
4. Bekannte Risiken in `KNOWN_ISSUES.md` beachten.

## Empfohlener Testablauf nach Dokumentationsaenderungen

Bei reinen Markdown-Aenderungen:

1. Dateinamen pruefen.
2. Inhalt auf Faktenbasis pruefen.
3. Keine Secrets dokumentieren.
4. Keine nicht belegten Funktionen oder URLs erfinden.

## Empfohlener Testablauf nach Codeaenderungen

Nach Codeaenderungen:

1. Syntaxcheck ausfuehren, z. B.:

```sh
node --check server.js
```

2. Server lokal starten:

```sh
npm start
```

3. Relevante Endpunkte manuell pruefen.

4. Frontend-Flow pruefen, wenn `public/js/wisy.js` oder Chat-Antwortformat betroffen ist.

5. n8n-Workflow pruefen, wenn `wisy.json` betroffen ist.

## Endpunkte, die bei Backend-Aenderungen relevant sein koennen

In `server.js` vorhanden:

- `GET /`
- `GET /whoami`
- `POST /api/wisy/chat`
- `POST /api/wisy/events`
- `POST /api/internal/wisy/lead-events`
- `GET /wisy-admin` (nur bei gesetztem Admin-Passwort)
- `POST /chat_old`
- `POST /chat`
- `POST /api/chat/match`
- `POST /api/chat/session`
- `GET /api/chat/session/:session_id`
- `DELETE /api/chat/session/:session_id`

Vor Aenderungen an den Session-Endpunkten immer zuerst pruefen, ob sie produktiv genutzt werden. Im gelesenen Frontend wurde keine aktive Nutzung gefunden; der dokumentierte aktive Pfad ist `/api/chat/match`.

## Pflichtfaelle fuer Wisy-Qualitaet

Bei AI-, Matching- oder Prompt-Aenderungen sollten mindestens diese Themen getestet werden:

- Begruessung
- Oeffnungszeiten
- Adresse
- Parken
- Kontakt
- Beratung
- Behandlungsfrage mit klarem Treffer
- Behandlungsfrage mit mehreren moeglichen Treffern
- unsichere oder unklare Anfrage
- Anfrage nach nicht dokumentierten Preisen oder Leistungen
- Anfrage mit `email adresse`
- Anfrage, bei der `Palais de Beaute` nicht in der Antwort erscheinen darf

## Wisy Q&A Regressionstest

Nach n8n-, AI-, Katalog- oder Conversion-Aenderungen sollten mindestens diese Fragen gegen den aktiven Wisy-Webhook getestet werden:

| Frage | Erwartung |
| --- | --- |
| `E Mail` | Antwort verweist auf das Kontaktformular, keine Gmail-Adresse. |
| `email adresse` | Muss als E-Mail/Kontaktfrage behandelt werden, nicht als Adressfrage. |
| `Adresse` | Antwort darf nur dokumentierte Adressinformationen verwenden. |
| `Parken` | Antwort darf nur dokumentierte Parkinformationen verwenden. |
| `Ich brauche Beratung` | Antwort zeigt Hautanalyse-Selbstterminierung und Kontaktformular. |
| `Hautanalyse buchen` | Antwort zeigt Hautanalyse-Selbstterminierung und Kontaktformular. |
| `Ich moechte eine professionelle Hautanalyse` | Antwort zeigt Hautanalyse-Selbstterminierung und Kontaktformular. |
| `Erzaehl mir mehr ueber Unterspritzungen` | Antwort nennt Botox/Botulinum/Faltenunterspritzung und Hyaluron Filler, sofern Links genannt werden nur dokumentierte Links verwenden. |
| `Bietet ihr Botox oder Botulinum an?` | Antwort bestaetigt Botox/Botulinum nur auf Basis dokumentierter Leistung und verweist auf die dokumentierte Faltenunterspritzung. |
| `Welches Geraet bei exodomentheraphie` | Tippfehler muss als Exosomen Therapie erkannt werden; wenn kein Geraet dokumentiert ist, keine Geraeteangabe erfinden. |
| `Welches Geraet bri exodomen` | Tippfehler muss als Exosomen Therapie erkannt werden; Antwort darf keinen Mitgliedschafts-CTA enthalten. |
| `Wie teuer ist 1 behandlung` | Keine Preise erfinden; nach konkreter Behandlung fragen und Hautanalyse/Kontakt anbieten. |
| `Welche Gesichtsbehandlungen bietet ihr an?` | Kurze Auswahl mit maximal wenigen passenden Optionen und klaren naechsten Schritten. |
| `Wie bekomme ich 10% Rabatt?` | Antwort erklaert Newsletter-Anmeldung als Ursprung des 10% Rabattcodes und erfindet keinen Code. |
| `Wie bekomme ich den Rabattcode?` | Antwort erklaert Newsletter-Anmeldung und verweist bei Hilfe auf das Kontaktformular. |
| `Gutscheincode` | Antwort nutzt Newsletter-/10%-Rabattlogik und erfindet keinen Code. |
| `Gutschein` | Antwort klaert zwischen Newsletter-Rabattcode und Geschenkgutschein. |
| `Ich moechte einen Geschenkgutschein kaufen` | Antwort verweist auf den dokumentierten Geschenkgutschein-Link. |
| `Ich suche ein Geschenk zum Geburtstag` | Antwort verweist auf den dokumentierten Geschenkgutschein-Link. |
| `Kuendigung` | Antwort verweist auf Kontaktformular, keine unpassende Mitgliedschaftsberatung. |
| `Kundogung` | Tippfehler muss ebenfalls zum Kontaktformular fuehren. |

Zusaetzliche Pflichtchecks fuer jede Antwort:

- Kein `Palais de Beaute` als Bot-Studio-Name.
- Keine direkte Gmail-Adresse.
- Keine erfundenen Preise.
- Keine erfundenen Leistungen.
- Keine erfundenen URLs.
- Klare, kurze naechste Handlung.

## n8n-Testregel

Bei jeder n8n-Aenderung:

- Switch-Reihenfolge pruefen.
- Email-Regel muss vor Adresse-Regel stehen.
- Speziell `email adresse` testen.
- AI Agent auf Halluzinationen pruefen.
- `katalog` Tool auf korrekte Links und korrekte Verfuegbarkeit pruefen.

## Bekannte Testluecken

- Kein automatisierter Browser-Ende-zu-Ende-Test fuer das Shopify-Live-Widget.
- Kein kontinuierlicher n8n-Regressionstest im Repository.
- Kein reproduzierbarer Integrationstest gegen eine isolierte Testdatenbank.
