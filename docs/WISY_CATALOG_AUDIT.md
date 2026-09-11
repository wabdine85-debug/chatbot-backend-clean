# Wisy Catalog Audit

Stand: 11. September 2026.

## Einordnung

Der produktive n8n-Katalog und `treatments.json` haben weiterhin bewusst
unterschiedliche Umfaenge. Eindeutig veraltete Links und redundante
Einzelpreise wurden jedoch in beiden aktiven Quellen korrigiert. Eine
automatische, rein lesende Pruefung steht unter
`scripts/audit-wisy-catalog.mjs` zur Verfuegung.

Ausfuehren:

```sh
node scripts/audit-wisy-catalog.mjs
```

Optional kann ein zuvor sicher und rein lesend erzeugter Shopify-Produktsnapshot
mitgegeben werden:

```sh
node scripts/audit-wisy-catalog.mjs --shopify-snapshot /path/to/products.json
```

Der Snapshot gehoert nicht ins Repository.

## Befund

- Backend-Katalog: 31 Eintraege.
- n8n-Katalog: 38 Eintraege.
- Acht IDs sind nur in n8n vorhanden.
- Eine abweichend benannte Alexandrit-ID ist nur im Backend vorhanden.
- Fuenf gemeinsame Eintraege unterscheiden sich bei URL, Preis, Prioritaet
  oder Beschreibung.
- Mehrere Produktlinks zeigten auf fehlende oder nicht gelistete
  Shopify-Produkte. Neun eindeutige Zuordnungen wurden in `treatments.json`
  und acht davon im lokalen sowie produktiven abgesicherten n8n-Workflow
  korrigiert; EMS Sculpt war in n8n bereits korrekt.
- Drei in n8n hinterlegte Einzelpreise wichen vom Shopify-Stand ab:
  Alexandrit, HydraFacial und Forma. Alle vier separat gepflegten
  Einzelbehandlungspreise wurden aus dem lokalen und produktiven n8n-Katalog
  entfernt, damit sie nicht parallel zu Shopify veralten; der vierte Preis war
  aktuell noch korrekt.
- Die Premium-Preise 149 EUR, 169 EUR und 199 EUR wurden auf der oeffentlichen
  Premium-Seite bestaetigt.
- Der aktive abgesicherte n8n-Workflow wurde zuerst als unveroeffentlichter
  Entwurf aktualisiert, strukturell geprueft und danach veroeffentlicht. Fuenf
  Live-Regressionen ueber den Render-Proxy waren erfolgreich.
- Der fruehere ungeschuetzte Workflow `wisy` wurde anschliessend nach
  bestaetigter Nichtnutzung seit der Umschaltung deaktiviert, nicht geloescht.

## Bewertung

- **Pflicht:** Veraltete Einzelpreise nicht als feste Antwortquelle verwenden.
- **Pflicht:** Nicht aktive Produktlinks auf belegte aktive Produkte umstellen
  oder bei unklarer Zuordnung zur Beratung fuehren.
- **Empfohlen:** `treatments.json` als kuratierte Quelle festlegen und den
  n8n-Katalog daraus reproduzierbar erzeugen.
- **Empfohlen:** Den Audit bei jeder Katalogaenderung ausfuehren.
- **Optional:** Preise regelmaessig aus einem rein lesenden Shopify-Export
  pruefen; keine Shopify-Zugangsdaten im Repository speichern.
- **Nicht empfohlen:** Preise parallel in Shopify, Backend und n8n manuell
  pflegen.

## Nicht eindeutig zugeordnet

Fuer `Ferninfrarot Tiefenwaerme & Lymphdrainage` und den allgemeinen Eintrag
`Vitamin Infusionen` wurde kein eindeutiges gleichnamiges aktives
Shopify-Produkt gefunden. Diese Eintraege duerfen nicht automatisch auf ein
anderes Produkt umgebogen oder als nicht mehr angeboten eingestuft werden.
