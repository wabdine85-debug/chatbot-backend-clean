# Decisions

Dokumentierte Produkt- und Architekturentscheidungen.

Historische Entscheidungen sind nur aufgenommen, wenn sie aus dem vorhandenen Projekt oder aus dem aktuellen Auftrag ableitbar sind.

## Entscheidung: Projektordner bleibt unveraendert

Status: entschieden

Der Projektordner wird nicht umbenannt.

## Entscheidung: Dokumentation zuerst

Status: entschieden

Vor Code-, Frontend-, n8n-, Package- oder Deployment-Aenderungen wird eine professionelle Dokumentationsbasis erstellt.

## Entscheidung: Wisy ist ein AI Sales Assistant

Status: entschieden

Wisy wird als AI Sales Assistant fuer PDB Aesthetic Room verstanden, nicht nur als technischer Chatbot.

Ziele:

- bessere Antworten
- weniger falsche Antworten
- mehr qualifizierte Leads
- mehr Buchungen
- hoehere Conversion
- konsistente Luxus-Markenstimme
- weniger Halluzinationen
- bessere Wartbarkeit

## Entscheidung: Markenname in Bot-Antworten

Status: entschieden

In Bot-Antworten soll immer `PDB Aesthetic Room` verwendet werden.

`Palais de Beaute` soll in Bot-Antworten niemals verwendet werden.

## Entscheidung: Kontaktweg

Status: entschieden

Bevorzugter Kontaktweg:

```txt
https://palaisdebeaute.de/pages/contact
```

Keine direkte Gmail-Adresse ausgeben.

## Entscheidung: Keine erfundenen Leistungen oder Preise

Status: entschieden

Wisy darf keine Preise oder Leistungen erfinden.

Wenn Informationen fehlen, soll Wisy eine Beratung oder das Kontaktformular empfehlen.

## Entscheidung: n8n Switch-Reihenfolge

Status: entschieden

Die Email-Regel im n8n Switch muss vor der Adresse-Regel stehen.

Begruendung:

`email adresse` kann sonst faelschlich als Adressanfrage erkannt werden.

## Entscheidung: Aenderungsarbeitsweise

Status: entschieden

Fuer zukuenftige Codex-Aufgaben:

- Immer zuerst analysieren.
- Keine Aenderung ohne Audit.
- Kleine sichere Aenderungen.
- Nach jeder Aenderung testen.
- Bestehende Funktionen nicht verschlechtern.
- Bei n8n-Aenderungen immer Switch-Reihenfolge pruefen.
- Bei AI-Aenderungen immer Halluzinationen und Conversion pruefen.
- Jede relevante Aenderung im `CHANGELOG.md` dokumentieren.

## Offene Architekturentscheidungen

Noch nicht entschieden oder nicht dokumentiert:

- Welche Chat-Route langfristig produktiv sein soll.
- Ob `/chat_old` und `/chat` erhalten bleiben sollen.
- Ob n8n oder Express langfristig die primaere AI-Orchestrierung sein soll.
- Wie `treatments.json` und n8n `katalog` synchron gehalten werden.
- Wie Session-Daten final gespeichert werden sollen.
- Ob und wie ein Staging-Deployment eingerichtet wird.
