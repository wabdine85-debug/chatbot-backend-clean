# Wisy Datenschutz-Faktenblatt

Stand: 11. September 2026

Dieses Dokument beschreibt ausschliesslich den technisch belegten Ist-Zustand.
Es ist keine Rechtsberatung, keine Datenschutzerklaerung und keine Behauptung
von DSGVO-Konformitaet. Nicht belegte Angaben sind als `nicht dokumentiert`
markiert.

## Aktiver Datenfluss

1. Eine Kundin oder ein Kunde oeffnet das Wisy-Widget im Shopify-Store.
2. Das Widget erzeugt eine zufaellige Session-ID und speichert sie fuer den
   aktuellen Browser-Tab in `sessionStorage`.
   Beim Oeffnen des Widgets wird Render einmal per GET ohne Nachricht und ohne
   Session-ID aufgeweckt, um Kaltstarts des Free-Plans abzufangen.
3. Die eingegebene Nachricht, maximal 600 Zeichen, und die Session-ID werden
   per HTTPS an den Render-Endpunkt `POST /api/wisy/chat` gesendet.
4. Render validiert die Anfrage und leitet Nachricht und Session-ID mit einem
   serverseitigen Authentifizierungsheader an den aktiven n8n-Webhook weiter.
5. n8n verarbeitet feste Regeln oder nutzt fuer freie Anfragen einen AI Agent
   mit OpenAI-Chatmodell und einem Memory-Fenster von fuenf Nachrichten pro
   Session-ID.
6. Render gibt nur Antwort, maximal sechs Buttons und dieselbe Session-ID an
   das Widget zurueck.
7. Nach einer erfolgreichen Chatantwort speichert Render separat nur eine
   feste Intent-Kategorie, nicht den freien Nachrichtentext, in PostgreSQL.
8. Bei einem erlaubten CTA-Klick speichert Render Session-ID, Zielroute und den
   validierten PDB-Ziel-Link als strukturiertes Ereignis in PostgreSQL.

## Beteiligte Systeme

- Shopify: Auslieferung des Storefront-Widgets und vorhandenes Kontaktformular.
- Render: oeffentlicher Wisy-Proxy und passwortgeschuetzte Lead-Ansicht.
- n8n Cloud: Workflow-Ausfuehrung, Routing und AI-Orchestrierung.
- OpenAI: Verarbeitung freier Chatfragen im AI-Pfad des n8n-Workflows.
- PostgreSQL: Speicherung der strukturierten Wisy-Lead- und Ereignisdaten.

Vertragsrollen, Auftragsverarbeitungsvertraege, konkrete Standorte,
Unterauftragsverarbeiter und Drittlandtransfermechanismen sind im Repository
`nicht dokumentiert` und muessen ausserhalb des Codes geprueft werden.

## Im aktiven Lead-Tracking gespeicherte Daten

### `wisy_leads`

- interne Datensatz-ID,
- pseudonyme Session-ID,
- Quelle,
- Funnel-Status,
- feste Intent-Kategorie,
- optionales Treatment-Interesse,
- Zeitpunkte fuer Erstellung, Aktualisierung und letzte Aktivitaet.

Kontaktname, E-Mail-Adresse und Telefonnummer sind technisch vorgesehen, werden
ueber die Kontaktstrecke nur nach aktiver Zustimmung gesetzt. Name und
mindestens E-Mail-Adresse oder Telefonnummer sind erforderlich. Die Datenbank
speichert dazu Einwilligungszeitpunkt und Einwilligungstextversion.

### `wisy_lead_events`

- interne Ereignis-ID und Lead-Zuordnung,
- fester Ereignistyp,
- Route,
- optionales Treatment-Interesse,
- validierter CTA-Ziel-Link,
- Ereigniszeitpunkt.

Freie Chatnachrichten werden von diesen beiden Tabellen nicht angenommen.

## Kurzlebige technische Daten

- Die Session-ID liegt bis zum Schliessen des Widgets beziehungsweise des Tabs
  in `sessionStorage`; beim Schliessen des Widgets wird sie entfernt.
- Der Render-Ratelimiter verwendet die anfragende IP-Adresse im
  Anwendungsspeicher fuer ein Zeitfenster von 60 Sekunden. Eine Speicherung
  dieser IP-Adresse in den Wisy-Lead-Tabellen findet nicht statt.
- Welche Request-Daten Render, n8n, OpenAI, Shopify oder vorgeschaltete Systeme
  in eigenen Betriebs- und Sicherheitslogs speichern, ist im Repository
  `nicht dokumentiert`.
- Aufbewahrung und Loeschung der n8n-Memory- und Execution-Daten sind
  `nicht dokumentiert`.

## Noch nicht aktiv

- keine automatische Zuordnung des Shopify-Kontaktformulars zur Wisy-Session,
- keine stille oder automatische Kontaktdatenerfassung ohne Zustimmung,
- keine Rueckmeldung eines Buchungsbeginns oder einer abgeschlossenen Buchung,
- keine automatische 90-Tage-Loeschung anonymer Wisy-Leads,
- keine automatische Loeschung historischer n8n-Executions durch dieses
  Repository.

## Pflicht vor identifizierbarem Lead-Closing

Vor einer Verknuepfung mit Name, E-Mail-Adresse, Telefonnummer,
Kontaktformular oder Buchung muessen mindestens geklaert und anschliessend im
Live-Datenschutztext korrekt abgebildet werden:

- Zweck und Rechtsgrundlage je Verarbeitungsschritt,
- erforderliche Information oder Einwilligung und deren Nachweis,
- Empfaenger, Auftragsverarbeiter und moegliche Drittlandtransfers,
- konkrete Aufbewahrungs- und Loeschfristen je System,
- Prozess fuer Auskunft, Widerruf, Widerspruch und Loeschung,
- Umgang mit versehentlich eingegebenen Gesundheitsdaten,
- fachliche beziehungsweise rechtliche Freigabe des finalen Textes.

Bis zur Kontaktfreigabe bleibt ein Dashboard-Eintrag auf anonyme Intent- und
CTA-Signale beschraenkt. Freigegebene Kontaktanfragen werden als
`contact_requested` angezeigt.
