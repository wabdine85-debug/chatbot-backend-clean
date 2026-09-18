# Wisy Lead Operations

Status: Vereinfachter Ein-Personen-Prozess nach Abstimmung vom 13. September
2026. Lokal implementiert, noch nicht produktiv ausgerollt.

## Aufgabe

Die interne Ansicht unter `/wisy-admin` unterstuetzt genau einen Ablauf:

1. Neue Kontaktanfrage pruefen.
2. Ausschliesslich freigegebene Kontaktdaten ueber den vereinbarten internen Weg
   an Noureen weiterleiten.
3. Danach `Als an Noureen weitergeleitet markieren` auswaehlen.

Die Markierung setzt den bereits vorhandenen Lead-Status auf
`handoff_created` und ergaenzt in derselben Transaktion ein gleichnamiges
Ereignis in `wisy_lead_events`.

## Bewusste Produktgrenze

Nicht enthalten sind:

- neue Datenbanktabellen oder Migrationen,
- Teamkonten und Rollen,
- Zustaendigkeiten,
- Wiedervorlagen,
- freie interne Notizen,
- automatische Bewertung oder Priorisierung,
- automatische Weiterleitung an eine nicht dokumentierte Adresse.

Die bestehende Lead-Datenbank bleibt notwendig, weil die Arbeitsliste und der
Uebergabestatus sonst nach einem Neustart nicht verlaesslich verfuegbar waeren.
Es wird aber kein zusaetzliches CRM-Datenmodell eingefuehrt.

## Sicherheit

- Der vorhandene Benutzername `wisy` und das mindestens 20 Zeichen lange
  `WISY_ADMIN_PASSWORD` schuetzen Ansicht und Aktion.
- Die Uebergabe erfordert einen benutzergebundenen, zeitlich begrenzten
  CSRF-Token und eine Same-Origin-Anfrage.
- Nur Leads mit ausdruecklicher Kontaktfreigabe und Status
  `contact_requested` koennen erstmals markiert werden.
- Wiederholte Uebergaben werden idempotent behandelt und erzeugen kein
  doppeltes Ereignis.
- Statusaenderung und Ereignis werden gemeinsam in einer Transaktion
  gespeichert.
- Freie Chattexte werden weder abgefragt noch angezeigt.
- Antworten bleiben `no-store` und verwenden restriktive
  Browser-Sicherheitsheader.

## Bedienung

Die Uebersicht bleibt ruhig und priorisiert kontaktierbare offene Anfragen. Der
Link `Lead pruefen` oeffnet eine fokussierte Detailansicht mit Kontakt,
dokumentiertem Anliegen und Aktivitaetsverlauf.

Die dunkle Karte `Uebergabe an Noureen` ist die einzige schreibende Aktion.
Sie weist ausdruecklich darauf hin, dass zuerst die tatsaechliche manuelle
Weiterleitung erfolgen muss. Nach erfolgreicher Markierung zeigt die Seite eine
klare Bestaetigung und entfernt die Aktion.

## Vor Produktivaktivierung

- Den tatsaechlich verwendeten, datenschutzkonformen internen Uebergabeweg mit
  Noureen festlegen.
- Migrationen sind fuer diesen Abschnitt nicht erforderlich.
- Code nach Review committen, pushen und kontrolliert deployen.
- Produktiv pruefen: Anmeldung, Ansicht, CSRF-Ablehnung, einmalige Uebergabe,
  erneuter Aufruf und Sicherheitsheader.
