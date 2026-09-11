# Conversion Strategy

Strategie zur Verbesserung von Leadgenerierung, Buchungen und Conversion.

## Ziel

Wisy soll Besucher nicht nur informieren, sondern qualifizieren und zur naechsten passenden Handlung fuehren.

## Gewuenschte naechste Handlungen

- Beratung anfragen
- Kontaktformular oeffnen
- passende Behandlung ansehen
- Premium-Mitgliedschaft ansehen
- Buchung starten

## Grundsaetze

- Keine aggressiven Verkaeufe.
- Keine langen, verwirrenden Texte.
- Klare Empfehlung mit naechstem Schritt.
- Bei Unsicherheit nicht erfinden, sondern Beratung empfehlen.
- Vertrauen vor Druck.
- Luxus-Markenstimme konsistent halten.

## Aktuell vorhandene Conversion-Mechaniken

Aus dem Projekt ersichtlich:

- `/api/chat/match` liefert `reply` und `buttons`.
- Kategorie-Fallbacks fuer `Haut & Gesicht`, `Anti-Aging & Straffung`, `Haarentfernung`.
- Kontakt-/Beratungsanfragen fuehren zum Kontaktformular.
- Treatment-Treffer liefern Buttons mit Treatment-Namen und URL.
- `public/js/wisy.js` rendert Buttons im Chat.

## Conversion-Risiken

- Unklare Rolle der parallelen Chat-Routen kann zu inkonsistentem Verhalten fuehren.
- Das lokale Frontend und das aktive Shopify-Widget verwenden unterschiedliche
  Implementierungen; produktiv nutzt Shopify den geschuetzten Render-Proxy.
- n8n-Katalog und `treatments.json` koennen unterschiedliche Empfehlungen erzeugen.
- Zu viele oder falsche Optionen koennen Nutzer verwirren.
- CTA-Klicks und Intent-Kategorien sind messbar; Kontaktuebergabe und gebuchte
  Termine sind noch nicht durchgaengig angebunden.
- Fehlende Dokumentation fuer Premium-Mitgliedschaften begrenzt sichere Empfehlungen.

## Antwortmuster

### Klare Anfrage

Ziel:

- passende Behandlung nennen
- kurz Nutzen einordnen
- Button zur Behandlung oder Buchung anbieten

### Unklare Anfrage

Ziel:

- kurze Praezisierungsfrage
- alternativ Beratung ueber Kontaktformular

### Kontakt-/Beratungsabsicht

Ziel:

- direkt zum Kontaktformular

### Nicht dokumentierte Information

Ziel:

- transparent bleiben
- keine Erfindung
- Beratung empfehlen

## Verbesserungsstrategie

Kurzfristig:

- produktive Route klaeren
- veraltete oder nicht mehr produktive Testpfade nach Audit bereinigen
- Kernantworten fuer Kontakt, Beratung, Adresse, Oeffnungszeiten und Fallback vereinheitlichen
- Halluzinationsregeln in n8n und Backend angleichen

Mittelfristig:

- eine Single Source of Truth fuer Treatments definieren
- Premium-Mitgliedschaften dokumentiert in die Datenbasis aufnehmen, falls gewuenscht
- sichere Antworttemplates fuer hochrelevante Conversion-Flows definieren
- Tracking fuer Button-Klicks und Kontaktformular-Uebergaben planen

Langfristig:

- Lead-Qualifizierung strukturieren
- Conversion-Funnel messen
- A/B-Tests fuer Antwortlaenge und CTA-Strategie einfuehren
- Qualitaetsreview fuer AI-Antworten etablieren

## Nicht dokumentiert

Nicht im Projekt dokumentiert:

- Conversion Tracking
- Analytics Events
- CRM-Uebergabe
- Buchungssystem-Integration
- Premium-Mitgliedschaftsdaten als strukturierte Backend-Daten
- A/B-Test-Infrastruktur
