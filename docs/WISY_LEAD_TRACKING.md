# Wisy Lead Tracking

Status: Datenbankmigration am 10. September 2026 produktiv angewendet. Die
Tabellen wurden leer angelegt. Der n8n-Staging-Webhook ist mit Header-Auth
abgesichert und getestet, bleibt aber inaktiv. Backend-Proxy, Lead-API und
Dashboard sind noch nicht live geschaltet.

## Ziel

Wisy soll Verkaufsabsicht strukturiert sichtbar machen, ohne komplette Chatverlaeufe oder freiwillig eingegebene Gesundheitsangaben in eine Lead-Tabelle zu kopieren.

## Datenmodell

Die Migration `db/migrations/001_create_wisy_lead_tracking.sql` definiert:

- `wisy_leads`: aktueller Status einer pseudonymen Wisy-Session.
- `wisy_lead_events`: nachvollziehbare Funnel-Ereignisse ohne freien Nachrichtentext.

Erfasst werden nur strukturierte Felder wie Intent, Treatment-Interesse, CTA und Status.

Der vorbereitete Backend-Proxy ordnet erfolgreiche Chat-Eingaben serverseitig
einer kleinen Intent-Kategorie (`booking`, `contact`, `price`, `treatment` oder
`general`) zu. Gespeichert wird nur diese Kategorie; der freie Nachrichtentext
wird nicht an die Lead-Tabellen uebergeben. Ein Fehler der Lead-Speicherung
unterbricht die Chat-Antwort nicht.

## Kontakt- und Einwilligungsregel

- Kontaktname, E-Mail-Adresse oder Telefonnummer duerfen erst nach einer ausdruecklichen Einwilligung gespeichert werden.
- Die Datenbankbedingung verhindert Kontaktdaten ohne gesetzte Einwilligung und Einwilligungszeitpunkt.
- Freie Chatnachrichten gehoeren nicht in `wisy_leads` oder `wisy_lead_events`.
- Medizinische Angaben oder Gesundheitsdetails duerfen nicht automatisch als Lead-Metadaten uebernommen werden.

## Vorgesehener Funnel

1. `session_started`
2. `intent_detected`
3. `recommendation_shown`
4. `cta_shown`
5. `cta_clicked`
6. optional `contact_consent_granted`
7. optional `contact_submitted`
8. `handoff_created` oder `booking_started`
9. `booked` oder `closed_lost`

## Aufbewahrung

Empfohlener technischer Ausgangspunkt:

- anonyme Sessions ohne Aktivitaet: nach 90 Tagen loeschen,
- Kontaktdaten: nur so lange aufbewahren, wie Einwilligung und Geschaeftszweck dies rechtfertigen,
- konkrete Fristen vor Livebetrieb mit der geltenden Datenschutzerklaerung und dem betrieblichen Loeschkonzept abstimmen.

## Noch nicht live geschaltet

- Den lokal vorbereiteten Backend-Proxy und den geschuetzten API-Endpunkt deployen.
- Weiterfuehrende n8n-Ereignisse fuer den geschuetzten internen Backend-Endpunkt einrichten.
- Weiterfuehrende Funnel-Ereignisse im aktiven n8n-Workflow ergaenzen.
- CTA-Klicks im Shopify-Widget erfassen.
- Geschuetzte Lead-Ansicht bereitstellen.
- Automatische Retention ausfuehren.

## n8n Staging

Der inaktive Workflow `wisy-v2-secure-staging` wurde mit eigener Webhook-Route
und expliziter Preis-Sicherheitsregel angelegt. Der Webhook verwendet das
n8n-Credential `Wisy Backend Webhook Auth v2` fuer den Header
`X-Wisy-Webhook-Secret`. Ein isolierter Test ergab ohne Authentifizierung HTTP
403 und mit Authentifizierung HTTP 200; danach wurde der Workflow wieder
deaktiviert. Der bisherige aktive Workflow `wisy` blieb unveraendert. Die
v2-Version darf erst nach Backend-Deployment und vollstaendigem
Ende-zu-Ende-Test dauerhaft aktiviert werden.
