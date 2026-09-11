# Wisy Lead Tracking

Status: Datenbankmigration am 10. September 2026 produktiv angewendet. Die
Tabellen wurden leer angelegt. Der n8n-Staging-Webhook ist mit Header-Auth
abgesichert, Ende-zu-Ende ueber den Render-Proxy getestet und jetzt aktiv. Das
Shopify-Live-Widget verwendet seit dem 11. September 2026 den geschuetzten
Render-Proxy und erfasst erlaubte CTA-Klicks datensparsam. Die Lead-Ansicht ist
seit dem 11. September 2026 passwortgeschuetzt live geschaltet.

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

## Datenschutz-Grenze fuer den naechsten Funnel-Schritt

Der erneute Live-Abgleich am 11. September 2026 fand in der aktuell
ausgelieferten Shopify-Datenschutzerklaerung keinen auffindbaren Wisy-Abschnitt.
Das Widget zeigt weiterhin den kurzen Hinweis, keine sensiblen
Gesundheitsdaten einzugeben. Dieser Hinweis allein ist keine Grundlage fuer
eine Verknuepfung mit identifizierbaren Kontaktdaten.

- **Pflicht:** Noch keine automatische Verbindung zwischen Wisy-Session und
  Shopify-Kontaktformular, Buchung, Name, E-Mail-Adresse oder Telefonnummer.
- **Empfohlen:** Zuerst den Datenschutztext, die Rechtsgrundlage, Empfaenger,
  Aufbewahrung und den betrieblichen Prozess fachlich beziehungsweise rechtlich
  pruefen und live veroeffentlichen.
- **Optional:** Danach eine datensparsame Quellenzuordnung und die Ereignisse
  `contact_submitted`, `booking_started` und `booked` umsetzen.
- **Nicht empfohlen:** Freie Chattexte, Gesundheitsangaben oder unsichtbar
  angehaengte Session-IDs in Kontakt- oder Buchungsdaten uebernehmen.

Diese technische Dokumentation ist keine Rechtsberatung und behauptet keine
DSGVO-Konformitaet. Der technisch belegte Datenfluss und die offenen Angaben
sind in `docs/WISY_PRIVACY_FACTS.md` zusammengefasst.

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

- Weiterfuehrende n8n-Ereignisse fuer den geschuetzten internen Backend-Endpunkt einrichten.
- Weiterfuehrende Funnel-Ereignisse im aktiven n8n-Workflow ergaenzen.
- Automatische Retention ausfuehren.
- Identifizierbare Kontakt- oder Buchungsdaten einer Wisy-Session zuordnen;
  dieser Schritt bleibt bis zur Datenschutzpruefung blockiert.

## Aktive Lead-Ansicht

Das Backend stellt die Lead-Ansicht unter `/wisy-admin` bereit. Sie wird nur
registriert, wenn `WISY_ADMIN_PASSWORD` mindestens 20 Zeichen lang ist. Der
Benutzername lautet `wisy`; das separate Passwort liegt nicht im Repository.

Die Ansicht zeigt Kennzahlen, Status, Intent, Treatment-Interesse, letzten
Funnel-Schritt und Aktivitaetszeit. Freie Chattexte werden weder abgefragt noch
angezeigt. Kontaktfelder werden zusaetzlich in der Anwendung entfernt, falls
keine Einwilligung gesetzt ist. Antworten verwenden `no-store` und restriktive
Browser-Sicherheitsheader. Der produktive Test bestaetigte HTTP 401 ohne
Anmeldung, HTTP 200 mit Anmeldung sowie die Kontakt-Einwilligungsregel.
Kennzahlen und Tabellenzeilen werden serverseitig gerendert, sodass die Ansicht
nicht von einem separaten JavaScript-Nachladevorgang im Browser abhaengt.

Der aktive Endpunkt `POST /api/wisy/events` nimmt ausschliesslich
strukturierte CTA-Klicks aus erlaubten Storefront-Origins entgegen. Ziel-URLs
muessen HTTPS verwenden und auf freigegebene Produkt-, Collection-, Kontakt-
oder Premium-Pfade von `palaisdebeaute.de` zeigen. Freie Texte und Kontaktdaten
werden nicht akzeptiert.

## n8n Staging

Der inaktive Workflow `wisy-v2-secure-staging` wurde mit eigener Webhook-Route
und expliziter Preis-Sicherheitsregel angelegt. Der Webhook verwendet das
n8n-Credential `Wisy Backend Webhook Auth v2` fuer den Header
`X-Wisy-Webhook-Secret`. Ein isolierter Test ergab ohne Authentifizierung HTTP
403 und mit Authentifizierung HTTP 200; danach wurde der Workflow zunaechst
wieder deaktiviert. Nach dem Backend-Deployment bestand auch der vollstaendige
Test ueber den Render-Proxy mit HTTP 200 und erhaltener Session-ID. Der Workflow
ist seitdem aktiv und wird ueber den Render-Proxy vom Live-Shopify-Widget
verwendet. Der alte ungeschuetzte Workflow `wisy` wurde am 11. September 2026
nach einem Traffic-Metadatencheck deaktiviert, aber nicht geloescht. Sein alter
Webhook antwortete danach mit HTTP 404; der geschuetzte Proxy weiterhin mit
HTTP 200.
