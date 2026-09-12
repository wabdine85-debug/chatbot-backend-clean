import crypto from "node:crypto";
import { Router } from "express";
import { createFixedWindowRateLimiter } from "./wisyChatProxy.js";

const DASHBOARD_USERNAME = "wisy";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const CONTACT_TOPIC_LABELS = {
  appointment_consultation: "Termin / Beratung",
  treatment_selection: "Beratung zur Behandlungsauswahl",
  pricing_offer: "Preis / Angebot",
  callback: "Rückruf",
  other: "Sonstiges",
};
const CONTACT_METHOD_LABELS = {
  email: "E-Mail",
  phone: "Telefon",
  either: "E-Mail oder Telefon",
};
const STATUS_LABELS = {
  new: "Neu",
  qualified: "Interesse erkannt",
  contact_requested: "Kontakt angefragt",
  handoff_created: "Übergabe erstellt",
  booking_started: "Buchung begonnen",
  booked: "Termin gebucht",
  closed_lost: "Ohne Abschluss",
};
const INTENT_LABELS = {
  general: "Allgemeine Frage",
  treatment: "Behandlung",
  contact: "Persönlicher Kontakt",
  booking: "Termin / Buchung",
  price: "Preis / Angebot",
};
const EVENT_LABELS = {
  session_started: "Gespräch begonnen",
  intent_detected: "Interesse erkannt",
  recommendation_shown: "Empfehlung angezeigt",
  cta_shown: "Nächster Schritt angezeigt",
  cta_clicked: "Link geöffnet",
  contact_consent_granted: "Kontakt freigegeben",
  contact_submitted: "Kontaktanfrage gesendet",
  handoff_created: "Übergabe erstellt",
  booking_started: "Buchung begonnen",
  booked: "Termin gebucht",
  closed_lost: "Ohne Abschluss beendet",
};

function safeEqual(receivedValue, expectedValue) {
  const received = Buffer.from(receivedValue, "utf8");
  const expected = Buffer.from(expectedValue, "utf8");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export function isValidBasicAuth(authorization, expectedPassword) {
  if (typeof expectedPassword !== "string" || expectedPassword.length < 20) return false;
  if (typeof authorization !== "string" || !authorization.startsWith("Basic ")) return false;

  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return safeEqual(username, DASHBOARD_USERNAME) && safeEqual(password, expectedPassword);
  } catch {
    return false;
  }
}

export function sanitizeDashboardLead(row) {
  const consentToContact = row.consent_to_contact === true;
  let latestCtaTarget = null;
  try {
    const target = new URL(row.latest_cta_target);
    if (target.protocol === "https:"
      && (target.hostname === "palaisdebeaute.de" || target.hostname === "www.palaisdebeaute.de")) {
      latestCtaTarget = `${target.origin}${target.pathname}${target.search}`;
    }
  } catch {}
  return {
    id: row.id,
    session_id: row.session_id,
    source: row.source,
    status: row.status,
    intent: row.intent,
    treatment_interest: row.treatment_interest,
    contact_name: consentToContact ? row.contact_name : null,
    contact_email: consentToContact ? row.contact_email : null,
    contact_phone: consentToContact ? row.contact_phone : null,
    contact_topic: consentToContact ? row.contact_topic : null,
    preferred_contact_method: consentToContact ? row.preferred_contact_method : null,
    consent_to_contact: consentToContact,
    created_at: row.created_at,
    last_activity_at: row.last_activity_at,
    event_count: Number(row.event_count || 0),
    latest_event_type: row.latest_event_type,
    latest_event_at: row.latest_event_at,
    latest_cta_target: latestCtaTarget,
  };
}

export async function loadLeadDashboard(pool, requestedLimit = DEFAULT_LIMIT) {
  const parsedLimit = Number.parseInt(requestedLimit, 10);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(MAX_LIMIT, Math.max(1, parsedLimit))
    : DEFAULT_LIMIT;

  const [summaryResult, leadsResult] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE last_activity_at >= NOW() - INTERVAL '7 days')::int AS active_7d,
        COUNT(*) FILTER (WHERE status IN ('contact_requested', 'handoff_created', 'booking_started'))::int AS actionable,
        COUNT(*) FILTER (WHERE status = 'booked')::int AS booked,
        COUNT(*) FILTER (WHERE consent_to_contact = TRUE)::int AS contactable,
        (
          SELECT COUNT(*)::int
          FROM wisy_lead_events
          WHERE event_type = 'cta_clicked'
            AND occurred_at >= NOW() - INTERVAL '7 days'
        ) AS cta_clicks_7d
      FROM wisy_leads
    `),
    pool.query(`
      SELECT
        lead.id,
        lead.session_id,
        lead.source,
        lead.status,
        lead.intent,
        lead.treatment_interest,
        lead.contact_name,
        lead.contact_email,
        lead.contact_phone,
        lead.contact_topic,
        lead.preferred_contact_method,
        lead.consent_to_contact,
        lead.created_at,
        lead.last_activity_at,
        COUNT(event.id)::int AS event_count,
        latest.event_type AS latest_event_type,
        latest.occurred_at AS latest_event_at,
        latest.cta_target AS latest_cta_target
      FROM wisy_leads AS lead
      LEFT JOIN wisy_lead_events AS event ON event.lead_id = lead.id
      LEFT JOIN LATERAL (
        SELECT event_type, occurred_at, cta_target
        FROM wisy_lead_events
        WHERE lead_id = lead.id
        ORDER BY occurred_at DESC
        LIMIT 1
      ) AS latest ON TRUE
      GROUP BY lead.id, latest.event_type, latest.occurred_at, latest.cta_target
      ORDER BY
        CASE
          WHEN lead.status IN ('contact_requested', 'handoff_created', 'booking_started') THEN 0
          ELSE 1
        END,
        lead.last_activity_at DESC
      LIMIT $1
    `, [limit]),
  ]);

  const summary = summaryResult.rows[0] || {};
  return {
    generated_at: new Date().toISOString(),
    summary: {
      total: Number(summary.total || 0),
      active_7d: Number(summary.active_7d || 0),
      actionable: Number(summary.actionable || 0),
      booked: Number(summary.booked || 0),
      contactable: Number(summary.contactable || 0),
      cta_clicks_7d: Number(summary.cta_clicks_7d || 0),
    },
    leads: leadsResult.rows.map(sanitizeDashboardLead),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function dashboardDate(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(date);
}

function dashboardValue(value) {
  return value === null || value === undefined || value === "" ? "–" : escapeHtml(value);
}

function dashboardLabel(labels, value) {
  return value ? dashboardValue(labels[value] || value) : "–";
}

function contactDetails(lead) {
  if (!lead.consent_to_contact) return '<span class="muted">Noch keine Kontaktfreigabe</span>';

  const parts = [];
  if (lead.contact_name) parts.push(`<strong>${escapeHtml(lead.contact_name)}</strong>`);
  if (lead.contact_email) {
    const email = escapeHtml(lead.contact_email);
    parts.push(`<a href="mailto:${email}">${email}</a>`);
  }
  if (lead.contact_phone) {
    const phone = escapeHtml(lead.contact_phone);
    const phoneTarget = String(lead.contact_phone).replace(/[^+0-9]/g, "");
    parts.push(phoneTarget ? `<a href="tel:${escapeHtml(phoneTarget)}">${phone}</a>` : phone);
  }

  const method = CONTACT_METHOD_LABELS[lead.preferred_contact_method];
  if (method) parts.push(`<small>Gewünscht: ${escapeHtml(method)}</small>`);
  return parts.join("<br>") || "–";
}

export function renderLeadDashboard(data, requestedStatus = "") {
  const statuses = [...new Set(data.leads.map((lead) => lead.status).filter(Boolean))].sort();
  const selectedStatus = statuses.includes(requestedStatus) ? requestedStatus : "";
  const visibleLeads = data.leads.filter((lead) => !selectedStatus || lead.status === selectedStatus);
  const statusOptions = ["", ...statuses]
    .map((status) => `<option value="${escapeHtml(status)}"${status === selectedStatus ? " selected" : ""}>${status ? dashboardLabel(STATUS_LABELS, status) : "Alle"}</option>`)
    .join("");
  const rows = visibleLeads.map((lead) => {
    const topic = CONTACT_TOPIC_LABELS[lead.contact_topic] || lead.treatment_interest || "–";
    const cta = lead.latest_cta_target
      ? `<a href="${escapeHtml(lead.latest_cta_target)}" target="_blank" rel="noopener noreferrer">Öffnen</a>`
      : "–";
    const reference = lead.session_id
      ? `<details><summary>Anzeigen</summary><code>${escapeHtml(lead.session_id)}</code></details>`
      : "–";
    const badgeClass = lead.status === "contact_requested" ? " badge--action" : lead.status === "booked" ? " badge--success" : "";
    return `<tr><td>${dashboardDate(lead.last_activity_at)}</td><td><span class="badge${badgeClass}">${dashboardLabel(STATUS_LABELS, lead.status)}</span></td><td>${dashboardLabel(INTENT_LABELS, lead.intent)}</td><td>${dashboardValue(topic)}</td><td>${dashboardLabel(EVENT_LABELS, lead.latest_event_type)}</td><td>${cta}</td><td class="contact">${contactDetails(lead)}</td><td class="reference">${reference}</td></tr>`;
  }).join("");

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Wisy Lead-Übersicht</title>
  <style>
    :root{color-scheme:light;--ink:#211d1a;--muted:#726a63;--line:#e9e2dc;--paper:#fbf9f7;--accent:#9d775c;--dark:#29221e}
    *{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(1180px,calc(100% - 32px));margin:40px auto 64px}header{display:flex;justify-content:space-between;gap:20px;align-items:end;margin-bottom:24px}
    h1{font:600 clamp(28px,4vw,44px)/1.1 Georgia,serif;margin:0 0 6px}.eyebrow{color:var(--accent);font-size:12px;font-weight:700;letter-spacing:.15em;text-transform:uppercase}
    .muted{color:var(--muted)}a{color:#654832;text-underline-offset:2px}button,select,.button{border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 13px;color:var(--ink);font:inherit}.button,button{cursor:pointer;background:var(--dark);color:#fff;text-decoration:none}
    .metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px}.metric strong{display:block;font:600 28px Georgia,serif}.metric span{color:var(--muted);font-size:12px}
    .toolbar{display:flex;gap:10px;align-items:center;margin:18px 0}.table-wrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:16px}table{width:100%;border-collapse:collapse;min-width:1050px}th,td{text-align:left;padding:13px 14px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#fffdfb;position:sticky;top:0}.badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#f1ebe6;font-size:12px;white-space:nowrap}.badge--action{background:#f5e4c6;color:#5c3b0b}.badge--success{background:#deeee2;color:#245332}.contact{white-space:normal}.contact a{display:inline-block}.reference{max-width:190px}.reference summary{cursor:pointer;color:var(--muted);font-size:12px}.reference code{display:block;margin-top:6px;overflow-wrap:anywhere;font-size:11px;color:var(--muted)}.empty{padding:40px;text-align:center;color:var(--muted)}
    @media(max-width:800px){main{margin-top:24px}.metrics{grid-template-columns:repeat(2,1fr)}header{align-items:start;flex-direction:column}}
  </style>
</head>
<body>
<main>
  <header><div><div class="eyebrow">PDB Aesthetic Room</div><h1>Wisy Leads</h1><div class="muted">Stand: ${dashboardDate(data.generated_at)}</div></div><a class="button" href="./">Aktualisieren</a></header>
  <section class="metrics" aria-label="Kennzahlen">
    <div class="metric"><strong>${data.summary.total}</strong><span>Leads gesamt</span></div>
    <div class="metric"><strong>${data.summary.active_7d}</strong><span>Aktiv in 7 Tagen</span></div>
    <div class="metric"><strong>${data.summary.actionable}</strong><span>Jetzt bearbeiten</span></div>
    <div class="metric"><strong>${data.summary.contactable}</strong><span>Kontaktanfragen</span></div>
    <div class="metric"><strong>${data.summary.cta_clicks_7d}</strong><span>CTA-Klicks in 7 Tagen</span></div>
    <div class="metric"><strong>${data.summary.booked}</strong><span>Gebucht</span></div>
  </section>
  <form class="toolbar" method="get" action="./"><label for="status">Status:</label><select id="status" name="status">${statusOptions}</select><button type="submit">Filtern</button></form>
  <div class="table-wrap"><table><thead><tr><th>Letzte Aktivität</th><th>Status</th><th>Interesse</th><th>Anliegen</th><th>Letzter Schritt</th><th>Geöffneter Link</th><th>Kontakt</th><th>Technische Referenz</th></tr></thead><tbody>${rows}</tbody></table>${visibleLeads.length ? "" : '<div class="empty">Keine Leads für diesen Filter.</div>'}</div>
</main>
</body>
</html>`;
}

function setDashboardSecurityHeaders(_req, res, next) {
  res.removeHeader("Access-Control-Allow-Origin");
  res.set({
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  next();
}

export function createWisyLeadDashboardRouter({ pool, adminPassword }) {
  if (!pool || typeof adminPassword !== "string" || adminPassword.length < 20) return null;

  const router = Router();
  router.use(createFixedWindowRateLimiter({ maxRequests: 60, windowMs: 60_000 }));
  router.use(setDashboardSecurityHeaders);
  router.use((req, res, next) => {
    if (!isValidBasicAuth(req.get("authorization"), adminPassword)) {
      res.set("WWW-Authenticate", 'Basic realm="Wisy Leads", charset="UTF-8"');
      return res.status(401).send("Authentifizierung erforderlich");
    }
    return next();
  });

  router.get("/", async (req, res) => {
    try {
      const data = await loadLeadDashboard(pool, req.query.limit);
      return res.type("html").send(renderLeadDashboard(data, req.query.status));
    } catch (error) {
      console.error("Wisy lead dashboard failed:", error.name || "Error");
      return res.status(500).send("Lead-Daten konnten nicht geladen werden");
    }
  });
  router.get("/api", async (req, res) => {
    try {
      return res.json(await loadLeadDashboard(pool, req.query.limit));
    } catch (error) {
      console.error("Wisy lead dashboard failed:", error.name || "Error");
      return res.status(500).json({ ok: false, error: "dashboard_unavailable" });
    }
  });

  return router;
}
