# Roadmap

Zukuenftige Verbesserungsstrategie fuer den Wisy AI Sales Assistant.

Diese Roadmap beschreibt empfohlene naechste Schritte. Sie dokumentiert keine bereits umgesetzten Funktionen, sofern sie nicht im Projekt vorhanden sind.

## Phase 1: Stabilisieren

Ziel:

- Klarheit ueber produktive Pfade
- weniger technische Risiken
- sichere Grundlage fuer weitere Verbesserungen

Empfohlene Schritte:

- produktive Chat-Route verbindlich festlegen
- `/api/chat/match`, `/chat` und `/chat_old` fachlich einordnen
- bekannte Route-/Test-Inkonsistenzen dokumentiert entscheiden
- Testablauf fuer wichtigste Chat-Flows etablieren
- Render-Deployment-Prozess dokumentieren
- Datenbankschema dokumentieren

## Phase 2: Antwortqualitaet verbessern

Ziel:

- bessere Antworten
- weniger falsche Antworten
- weniger Halluzinationen

Empfohlene Schritte:

- Treatment-Datenqualitaet pruefen
- einheitliche Fallback-Strategie definieren
- klare Antworttemplates fuer Kernfaelle erstellen
- AI-Regeln fuer Markenname, Kontakt und Preislogik absichern
- n8n `katalog` und `treatments.json` auf Abweichungen pruefen

## Phase 3: Conversion verbessern

Ziel:

- mehr qualifizierte Leads
- mehr Buchungen
- hoehere Conversion

Empfohlene Schritte:

- CTAs pro Intent definieren
- Button-Logik vereinheitlichen
- Kontaktformular als sicheren Eskalationspfad staerken
- Premium-Mitgliedschaften dokumentiert integrieren, falls produktiv gewuenscht
- Klick- und Funnel-Messung planen

## Phase 4: Wartbarkeit verbessern

Ziel:

- weniger doppelte Logik
- klarere Ownership
- einfachere Tests

Empfohlene Schritte:

- Single Source of Truth fuer Treatments festlegen
- Session-Tabellen und DB-Zugriffsmuster vereinheitlichen
- alte, unklare oder nicht mehr produktive Pfade nach Audit und Freigabe bereinigen
- automatisierte Tests ergaenzen
- Node-Version dokumentieren

## Phase 5: AI Sales Assistant ausbauen

Ziel:

- Wisy als hochwertiger digitaler Concierge fuer PDB Aesthetic Room

Empfohlene Schritte:

- strukturierte Lead-Qualifizierung
- Beratungslogik nach Problem, Ziel, Zone und Dringlichkeit
- sichere Empfehlungsmatrix
- Premium- und Buchungsstrecken integrieren, sofern dokumentiert
- regelmaessiges Antwortqualitaetsreview

## Nicht dokumentiert

Nicht im aktuellen Projekt dokumentiert:

- Staging-Umgebung
- Monitoring
- Analytics
- CRM-Integration
- Buchungssystem-API
- vollstaendige Premium-Mitgliedschaftsdaten im Backend
- automatisierte Testpipeline
