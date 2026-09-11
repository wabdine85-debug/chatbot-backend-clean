# AGENTS.md

Arbeitsanweisung fuer Codex, Agenten und Entwickler in diesem Repository.

## Projektidentitaet

Dieses Repository ist die technische Basis fuer den Wisy AI Sales Assistant fuer PDB Aesthetic Room.

Wisy ist nicht nur ein technischer Chatbot. Das Ziel ist ein vertrauensbildender, conversion-orientierter AI Sales Assistant mit konsistenter Luxus-Markenstimme.

## Oberste Arbeitsregeln

- Immer zuerst analysieren.
- Keine Aenderungen ohne Audit und klare Freigabe.
- Kleine, sichere Aenderungen bevorzugen.
- Nach jeder relevanten Aenderung testen.
- Bestehende Funktionen nicht verschlechtern.
- Keine Secrets aus `.env` anzeigen oder dokumentieren.
- Keine Preise, Leistungen, Datenbanktabellen, URLs oder Funktionen erfinden.
- Wenn etwas nicht im Projekt dokumentiert ist, als `nicht dokumentiert` kennzeichnen.

## Geschuetzte Bereiche

Ohne explizite Freigabe nicht aendern:

- Backend-Code, insbesondere `server.js`
- Frontend-Code unter `public/`
- n8n-Workflow `wisy.json`
- `package.json` und `package-lock.json`
- Render-/Deployment-Konfiguration
- Treatment-Daten in `treatments.json`
- FAQ-Daten in `faq.json`

## Marken- und Geschaeftsregeln

- Studio immer als `PDB Aesthetic Room` bezeichnen.
- In Bot-Antworten niemals `Palais de Beaute` verwenden.
- Kontakt bevorzugt ueber `https://palaisdebeaute.de/pages/contact`.
- Keine direkte Gmail-Adresse ausgeben.
- Keine Preise oder Leistungen erfinden.
- Wenn Informationen fehlen: Beratung oder Kontaktformular empfehlen.
- Antworten sollen luxurioes, kompetent, klar und zielfuehrend sein.
- Keine aggressiven Sales-Texte.
- Jede Antwort soll einen sinnvollen naechsten Schritt unterstuetzen.

## Wichtige Projektdateien

- `server.js`: Express-Backend und aktive Chat-Endpunkte.
- `package.json`: Node-Projektdefinition und Startskript.
- `treatments.json`: lokaler Treatment-Katalog fuer Backend-Matching.
- `faq.json`: kleine FAQ-Datenbasis.
- `public/js/wisy.js`: Frontend-Chatlogik mit Render-Endpunkt.
- `public/wisy.html`: lokales/statisches Chat-Frontend.
- `wisy.json`: n8n-Workflow-Export mit Webhook, Switch, AI Agent, OpenAI-Modell, Memory und `katalog` Tool.
- `pdb-treatments-export/index.mjs`: Shopify-Produktexport-Skript.

## n8n-Regel

Bei jeder n8n-Aenderung muss die Switch-Reihenfolge geprueft werden.

Die Email-Regel im Switch muss vor der Adresse-Regel stehen. Sonst kann `email adresse` faelschlich als Adressanfrage erkannt werden.

## AI-Aenderungen

Bei jeder AI- oder Prompt-Aenderung pruefen:

- Werden keine Leistungen erfunden?
- Werden keine Preise erfunden?
- Wird `PDB Aesthetic Room` korrekt verwendet?
- Wird `Palais de Beaute` in Bot-Antworten vermieden?
- Fuehrt die Antwort zu einem sinnvollen naechsten Schritt?
- Ist die Antwort kurz, klar und vertrauensbildend?
- Wird bei Unsicherheit Beratung oder Kontaktformular empfohlen?

## Testpflicht

Nach relevanten Aenderungen mindestens pruefen:

- Syntaxcheck, sofern Code betroffen ist.
- Relevante Chat-Endpunkte.
- Matching gegen `treatments.json`.
- Kontakt-/Beratungsfalle.
- Fallback-Verhalten.
- n8n Switch-Reihenfolge bei Workflow-Aenderungen.

## Changelog-Pflicht

Jede relevante Aenderung muss in `CHANGELOG.md` dokumentiert werden.
