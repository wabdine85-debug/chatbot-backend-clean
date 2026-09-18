import crypto from "node:crypto";
import express, { Router } from "express";
import { createFixedWindowRateLimiter } from "./wisyChatProxy.js";

const DASHBOARD_USERNAME = "wisy";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const ACTIONABLE_STATUSES = new Set(["contact_requested", "handoff_created", "booking_started"]);
const DASHBOARD_VIEWS = new Set(["all", "actionable", "contacts", "booked"]);
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
  handoff_created: "An Team übergeben",
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
  handoff_created: "An Team übergeben",
  booking_started: "Buchung begonnen",
  booked: "Termin gebucht",
  closed_lost: "Ohne Abschluss beendet",
};

function safeEqual(receivedValue, expectedValue) {
  const received = crypto.createHash("sha256").update(String(receivedValue), "utf8").digest();
  const expected = crypto.createHash("sha256").update(String(expectedValue), "utf8").digest();
  return crypto.timingSafeEqual(received, expected);
}

function parseBasicAuth(authorization) {
  if (typeof authorization !== "string" || !authorization.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function isValidBasicAuth(authorization, expectedPassword) {
  const credentials = parseBasicAuth(authorization);
  return Boolean(credentials
    && typeof expectedPassword === "string"
    && expectedPassword.length >= 20
    && safeEqual(credentials.username, DASHBOARD_USERNAME)
    && safeEqual(credentials.password, expectedPassword));
}

export function createCsrfToken(userId, secret, now = Date.now()) {
  if (typeof secret !== "string" || secret.length < 20) return "";
  const encodedUserId = Buffer.from(userId, "utf8").toString("base64url");
  const payload = `${Math.floor(now / 1000)}.${crypto.randomBytes(18).toString("base64url")}.${encodedUserId}`;
  const signature = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return Buffer.from(`${payload}.${signature}`, "utf8").toString("base64url");
}

export function verifyCsrfToken(token, userId, secret, now = Date.now()) {
  if (typeof token !== "string" || typeof secret !== "string" || secret.length < 20) return false;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 4 || Buffer.from(parts[2], "base64url").toString("utf8") !== userId) return false;
    const issuedAt = Number(parts[0]);
    if (!Number.isInteger(issuedAt) || issuedAt > Math.floor(now / 1000) + 60 || issuedAt < Math.floor(now / 1000) - 7200) return false;
    const payload = parts.slice(0, 3).join(".");
    const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
    return safeEqual(parts[3], expected);
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
        COUNT(*) FILTER (
          WHERE status IN ('contact_requested', 'handoff_created', 'booking_started')
            AND consent_to_contact = TRUE
        )::int AS actionable,
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
          WHEN lead.status IN ('contact_requested', 'handoff_created', 'booking_started')
            AND lead.consent_to_contact = TRUE THEN 0
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

function dashboardDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function dashboardValue(value) {
  return value === null || value === undefined || value === "" ? "–" : escapeHtml(value);
}

function dashboardLabel(labels, value) {
  return value ? dashboardValue(labels[value] || value) : "–";
}

function contactDetails(lead) {
  if (!lead.consent_to_contact) return '<span class="muted">Anonymes Signal · kein Kontakt möglich</span>';

  const parts = [];
  if (lead.contact_name) parts.push(`<strong>${escapeHtml(lead.contact_name)}</strong>`);
  if (lead.contact_email) {
    const email = String(lead.contact_email);
    parts.push(`<a href="mailto:${escapeHtml(encodeURIComponent(email))}">${escapeHtml(email)}</a>`);
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

function dashboardHref(view, status = "") {
  const query = new URLSearchParams();
  if (view && view !== "all") query.set("view", view);
  if (status) query.set("status", status);
  const suffix = query.toString();
  return suffix ? `./?${escapeHtml(suffix)}` : "./";
}

function leadTopic(lead) {
  return CONTACT_TOPIC_LABELS[lead.contact_topic] || lead.treatment_interest || "–";
}

function filterDashboardLeads(leads, view, status) {
  return leads.filter((lead) => {
    if (status && lead.status !== status) return false;
    if (view === "actionable") return ACTIONABLE_STATUSES.has(lead.status) && lead.consent_to_contact === true;
    if (view === "contacts") return lead.consent_to_contact === true;
    if (view === "booked") return lead.status === "booked";
    return true;
  });
}

function statusBadge(lead) {
  const badgeClass = ACTIONABLE_STATUSES.has(lead.status)
    ? " badge--action"
    : lead.status === "booked"
      ? " badge--success"
      : "";
  return `<span class="badge${badgeClass}">${dashboardLabel(STATUS_LABELS, lead.status)}</span>`;
}

function ctaLink(lead) {
  return lead.latest_cta_target
    ? `<a class="text-link" href="${escapeHtml(lead.latest_cta_target)}" target="_blank" rel="noopener noreferrer">Zielseite öffnen</a>`
    : '<span class="muted">Kein Link geöffnet</span>';
}

function technicalReference(lead) {
  return lead.session_id
    ? `<details><summary>Referenz</summary><code translate="no">${escapeHtml(lead.session_id)}</code></details>`
    : "–";
}

function renderLeadTableRow(lead) {
  return `<tr><td>${dashboardDate(lead.last_activity_at)}</td><td>${statusBadge(lead)}</td><td>${dashboardLabel(INTENT_LABELS, lead.intent)}</td><td>${dashboardValue(leadTopic(lead))}</td><td class="contact">${contactDetails(lead)}</td><td><a class="record-link" href="./lead/${encodeURIComponent(lead.id)}">Lead prüfen <span aria-hidden="true">→</span></a></td></tr>`;
}

function renderLeadCard(lead) {
  return `<article class="lead-card">
    <div class="lead-card__top"><div>${statusBadge(lead)}</div><time datetime="${escapeHtml(dashboardDateTime(lead.last_activity_at))}">${dashboardDate(lead.last_activity_at)}</time></div>
    <div class="lead-card__topic"><span>Anliegen</span><strong>${dashboardValue(leadTopic(lead))}</strong></div>
    <dl><div><dt>Interesse</dt><dd>${dashboardLabel(INTENT_LABELS, lead.intent)}</dd></div><div><dt>Letzter Schritt</dt><dd>${dashboardLabel(EVENT_LABELS, lead.latest_event_type)}</dd></div></dl>
    <div class="lead-card__contact">${contactDetails(lead)}</div>
    <div class="lead-card__footer"><a class="record-link" href="./lead/${encodeURIComponent(lead.id)}">Lead prüfen <span aria-hidden="true">→</span></a>${technicalReference(lead)}</div>
  </article>`;
}

export function renderLeadDashboard(data, requestedFilters = {}) {
  const filters = typeof requestedFilters === "string" ? { status: requestedFilters } : requestedFilters;
  const statuses = [...new Set(data.leads.map((lead) => lead.status).filter(Boolean))].sort();
  const selectedStatus = statuses.includes(filters.status) ? filters.status : "";
  const selectedView = DASHBOARD_VIEWS.has(filters.view) ? filters.view : "all";
  const visibleLeads = filterDashboardLeads(data.leads, selectedView, selectedStatus);
  const statusOptions = ["", ...statuses]
    .map((status) => `<option value="${escapeHtml(status)}"${status === selectedStatus ? " selected" : ""}>${status ? dashboardLabel(STATUS_LABELS, status) : "Alle"}</option>`)
    .join("");
  const rows = visibleLeads.map(renderLeadTableRow).join("");
  const cards = visibleLeads.map(renderLeadCard).join("");
  const views = [
    ["all", "Alle Leads", data.summary.total],
    ["actionable", "Arbeitsliste", data.summary.actionable],
    ["contacts", "Kontaktanfragen", data.summary.contactable],
    ["booked", "Gebucht", data.summary.booked],
  ].map(([view, label, count]) => `<a class="view-tab${view === selectedView ? " is-active" : ""}" href="${dashboardHref(view, selectedStatus)}"${view === selectedView ? ' aria-current="page"' : ""}><span>${escapeHtml(label)}</span><strong>${Number(count || 0)}</strong></a>`).join("");
  const emptyState = selectedView === "actionable"
    ? "Keine offenen Kontakt- oder Buchungsschritte."
    : "Keine Leads für diese Auswahl.";

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#eef3f1">
  <title>Wisy Leads · PDB Aesthetic Room</title>
  <style>
    :root{color-scheme:light;--ink:#18201d;--muted:#66736f;--line:#dfe6e2;--paper:#f7f8f7;--surface:#fff;--mineral:#315d52;--mineral-soft:#e7efec;--champagne:#b99b6b;--rose:#9b5147;--rose-soft:#f5e8e5;--success:#386449;--success-soft:#e5f0e8}
    *{box-sizing:border-box}html{background:var(--paper)}body{margin:0;color:var(--ink);font:15px/1.5 "Avenir Next",Avenir,"Segoe UI",sans-serif;background:linear-gradient(180deg,#eef3f1 0,transparent 260px),var(--paper);overflow-wrap:anywhere}a,button,select,summary{touch-action:manipulation;-webkit-tap-highlight-color:rgba(49,93,82,.16)}
    main{width:min(1240px,calc(100% - 40px));margin:0 auto;padding:42px 0 72px}.page-header{display:flex;justify-content:space-between;gap:28px;align-items:flex-end;margin-bottom:30px}.page-header__copy{max-width:710px}
    h1{font:500 clamp(34px,5vw,58px)/.98 "Iowan Old Style",Baskerville,"Times New Roman",serif;letter-spacing:-.035em;margin:5px 0 12px;text-wrap:balance}.eyebrow{color:var(--mineral);font:700 11px/1.2 "SFMono-Regular",Consolas,monospace;letter-spacing:.16em;text-transform:uppercase}.intro{color:var(--muted);font-size:16px;margin:0;max-width:62ch;text-wrap:pretty}.muted{color:var(--muted)}a{color:var(--mineral);text-underline-offset:3px}
    .skip-link{position:fixed;z-index:10;top:10px;left:10px;transform:translateY(-150%);padding:10px 14px;border-radius:9px;background:var(--ink);color:#fff}.skip-link:focus{transform:translateY(0)}.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 16px;border:1px solid var(--mineral);background:var(--mineral);border-radius:999px;color:#fff;text-decoration:none;font-weight:650;white-space:nowrap}.button:hover{background:#244c42}.button:focus-visible,a:focus-visible,button:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid rgba(185,155,107,.58);outline-offset:3px}
    .focus-panel{display:grid;grid-template-columns:minmax(220px,.75fr) 2fr;background:var(--ink);color:#fff;border-radius:22px;overflow:hidden;box-shadow:0 20px 55px rgba(24,32,29,.12)}.focus-panel__summary{padding:26px 28px;border-right:1px solid rgba(255,255,255,.14);position:relative}.focus-panel__summary:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--champagne)}.focus-panel__summary span{display:block;color:#b9c7c2;font-size:12px}.focus-panel__summary strong{display:block;font:500 50px/1 "Iowan Old Style",Baskerville,serif;margin:4px 0;font-variant-numeric:tabular-nums}.focus-panel__summary p{margin:7px 0 0;color:#dce5e2;font-size:13px}
    .view-tabs{display:grid;grid-template-columns:repeat(4,1fr)}.view-tab{display:flex;min-width:0;flex-direction:column;justify-content:center;padding:23px 20px;color:#cbd6d2;text-decoration:none;border-right:1px solid rgba(255,255,255,.1);transition:background .15s ease,color .15s ease}.view-tab:last-child{border-right:0}.view-tab:hover,.view-tab.is-active{background:rgba(255,255,255,.09);color:#fff}.view-tab.is-active{box-shadow:inset 0 -3px var(--champagne)}.view-tab span{font-size:12px;white-space:nowrap}.view-tab strong{font:500 27px/1.2 "Iowan Old Style",Baskerville,serif;font-variant-numeric:tabular-nums}
    .page-header__action{display:flex;align-items:flex-end;flex-direction:column;gap:7px}.updated{color:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}.signal-strip{display:flex;gap:32px;margin:20px 0 8px;padding:0 4px;color:var(--muted);font-size:12px}.signal-strip strong{color:var(--ink);font-size:15px;margin-right:5px;font-variant-numeric:tabular-nums}.toolbar{display:flex;gap:12px;align-items:end;justify-content:space-between;margin:24px 0 14px}.toolbar__field{display:flex;gap:8px;align-items:center}.toolbar label{font-weight:650}.toolbar select{min-height:42px;border:1px solid var(--line);background-color:var(--surface);border-radius:10px;padding:8px 34px 8px 12px;color:var(--ink);font:inherit}.toolbar button{min-height:42px;border:0;background:transparent;color:var(--mineral);font:inherit;font-weight:650;cursor:pointer}.toolbar button:hover{color:var(--ink);text-decoration:underline;text-underline-offset:3px}.result-count{color:var(--muted);font-size:13px;font-variant-numeric:tabular-nums}
    .table-wrap{overflow:auto;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 8px 30px rgba(24,32,29,.045)}table{width:100%;border-collapse:collapse;min-width:960px}th,td{text-align:left;padding:15px 16px;border-bottom:1px solid var(--line);vertical-align:top}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#fafcfb}th{font:700 10px/1.3 "SFMono-Regular",Consolas,monospace;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#f9fbfa;position:sticky;top:0}.badge{display:inline-block;padding:4px 9px;border-radius:999px;background:var(--mineral-soft);color:var(--mineral);font-size:12px;font-weight:650;white-space:nowrap}.badge--action{background:var(--rose-soft);color:var(--rose)}.badge--success{background:var(--success-soft);color:var(--success)}.contact{white-space:normal}.contact a{display:inline-block;font-weight:600}.contact small{display:block;color:var(--muted)}.record-link{font-weight:700;white-space:nowrap;text-decoration:none}.record-link:hover{text-decoration:underline}.text-link{font-weight:600}.reference{max-width:180px}details summary{cursor:pointer;color:var(--muted);font-size:12px}details code{display:block;margin-top:6px;overflow-wrap:anywhere;font:11px/1.45 "SFMono-Regular",Consolas,monospace;color:var(--muted)}.empty{padding:56px 24px;text-align:center;color:var(--muted)}
    .lead-cards{display:none}.lead-card{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 8px 24px rgba(24,32,29,.05)}.lead-card__top,.lead-card__footer{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.lead-card__top time{color:var(--muted);font-size:12px}.lead-card__topic{margin:17px 0}.lead-card__topic span,dt{display:block;color:var(--muted);font:700 10px/1.3 "SFMono-Regular",Consolas,monospace;text-transform:uppercase;letter-spacing:.07em}.lead-card__topic strong{display:block;margin-top:3px;font-size:18px}.lead-card dl{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0}.lead-card dd{margin:3px 0 0}.lead-card__contact{margin:18px -18px;padding:16px 18px;border-block:1px solid var(--line);background:#fafcfb}.lead-card__contact a{display:block;font-weight:650;margin-top:3px}.lead-card__footer{align-items:center}.lead-card__footer details{text-align:right}.lead-card__footer .text-link{font-size:13px}
    @media(max-width:900px){main{width:min(100% - 28px,760px);padding-top:28px}.page-header{align-items:flex-start}.focus-panel{grid-template-columns:1fr}.focus-panel__summary{border-right:0;border-bottom:1px solid rgba(255,255,255,.14)}.view-tabs{grid-template-columns:repeat(2,1fr)}.view-tab{border-bottom:1px solid rgba(255,255,255,.1)}.view-tab:nth-child(2n){border-right:0}.view-tab:last-child{border-bottom:0}.table-wrap{display:none}.lead-cards{display:grid;gap:12px}.empty{background:var(--surface);border:1px solid var(--line);border-radius:16px}}
    @media(max-width:560px){main{width:calc(100% - 24px);padding-top:20px}.page-header{display:block}.page-header__action{align-items:flex-start;margin-top:18px}.focus-panel__summary{padding:22px}.view-tab{padding:18px 15px}.view-tab span{white-space:normal}.signal-strip{gap:16px;flex-wrap:wrap}.toolbar{align-items:flex-start;flex-direction:column}.toolbar__field{width:100%;align-items:stretch;flex-direction:column}.toolbar select{width:100%}.lead-card dl{grid-template-columns:1fr}.lead-card__footer{align-items:flex-start}}
    @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  </style>
</head>
<body>
<a class="skip-link" href="#lead-content">Direkt zu den Leads</a>
<main id="lead-content">
  <header class="page-header"><div class="page-header__copy"><div class="eyebrow"><span translate="no">PDB Aesthetic Room</span> · interner Bereich</div><h1>Wisy Leads</h1><p class="intro">Kontaktanfragen stehen zuerst. Anonyme Signale zeigen Interesse, enthalten aber bewusst keine Kontaktdaten.</p></div><div class="page-header__action"><a class="button" href="${dashboardHref(selectedView, selectedStatus)}">Daten aktualisieren</a><span class="updated">Stand: ${dashboardDate(data.generated_at)}</span></div></header>
  <section class="focus-panel" aria-label="Lead-Arbeitsbereich">
    <div class="focus-panel__summary"><span>Offen zur Bearbeitung</span><strong>${data.summary.actionable}</strong><p>Freigegebener Kontakt mit offenem nächsten Schritt</p></div>
    <nav class="view-tabs" aria-label="Ansicht auswählen">${views}</nav>
  </section>
  <div class="signal-strip" aria-label="Weitere Kennzahlen"><span><strong>${data.summary.active_7d}</strong>aktiv in 7 Tagen</span><span><strong>${data.summary.cta_clicks_7d}</strong>geöffnete Links in 7 Tagen</span></div>
  <form class="toolbar" method="get" action="./"><input type="hidden" name="view" value="${escapeHtml(selectedView)}"><div class="toolbar__field"><label for="status">Status eingrenzen</label><select id="status" name="status">${statusOptions}</select><button type="submit">Auswahl anwenden</button></div><div class="result-count">${visibleLeads.length} ${visibleLeads.length === 1 ? "Eintrag" : "Einträge"}</div></form>
  <div class="table-wrap"><table><thead><tr><th>Letzte Aktivität</th><th>Status</th><th>Interesse</th><th>Anliegen</th><th>Kontakt</th><th>Aktion</th></tr></thead><tbody>${rows}</tbody></table>${visibleLeads.length ? "" : `<div class="empty">${emptyState}</div>`}</div>
  <section class="lead-cards" aria-label="Leads">${cards || `<div class="empty">${emptyState}</div>`}</section>
</main>
</body>
</html>`;
}

export async function loadLeadRecord(pool, leadId) {
  const [leadResult, eventResult] = await Promise.all([
    pool.query(`
      SELECT id, session_id, source, status, intent, treatment_interest,
        contact_name, contact_email, contact_phone, contact_topic,
        preferred_contact_method, consent_to_contact, created_at,
        last_activity_at
      FROM wisy_leads
      WHERE id = $1
    `, [leadId]),
    pool.query(`
      SELECT event_type, occurred_at, cta_target
      FROM wisy_lead_events
      WHERE lead_id = $1
      ORDER BY occurred_at DESC
      LIMIT 100
    `, [leadId]),
  ]);
  if (!leadResult.rows[0]) return null;
  const lead = sanitizeDashboardLead(leadResult.rows[0]);
  lead.latest_event_type = eventResult.rows[0]?.event_type || null;
  lead.latest_event_at = eventResult.rows[0]?.occurred_at || null;
  return {
    lead,
    events: eventResult.rows,
  };
}

export async function markLeadHandedOff(pool, leadId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updateResult = await client.query(`
      UPDATE wisy_leads
      SET status = 'handoff_created',
        updated_at = NOW(),
        last_activity_at = NOW()
      WHERE id = $1
        AND status = 'contact_requested'
        AND consent_to_contact = TRUE
      RETURNING id
    `, [leadId]);
    if (!updateResult.rows[0]) {
      const currentResult = await client.query(
        "SELECT status, consent_to_contact FROM wisy_leads WHERE id = $1",
        [leadId],
      );
      await client.query("ROLLBACK");
      const current = currentResult.rows[0];
      if (!current) return { ok: false, error: "not_found" };
      if (current.status === "handoff_created") return { ok: true, alreadyDone: true };
      if (current.consent_to_contact !== true) return { ok: false, error: "not_contactable" };
      return { ok: false, error: "invalid_status" };
    }
    await client.query(`
      INSERT INTO wisy_lead_events (lead_id, event_type, occurred_at)
      VALUES ($1, 'handoff_created', NOW())
    `, [leadId]);
    await client.query("COMMIT");
    return { ok: true, alreadyDone: false };
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export function renderLeadRecord(record, context = {}) {
  const { lead, events } = record;
  const csrfToken = context.csrfToken || "";
  const timeline = events.map((event) => `<li><span class="timeline-dot"></span><div><strong>${dashboardLabel(EVENT_LABELS, event.event_type)}</strong><p>${dashboardDate(event.occurred_at)}</p>${event.cta_target ? ctaLink({ latest_cta_target: sanitizeDashboardLead({ latest_cta_target: event.cta_target }).latest_cta_target }) : ""}</div></li>`).join("") || '<li class="empty-line">Noch keine Aktivität dokumentiert.</li>';
  const success = context.saved ? '<div class="notice" role="status">Als an Noureen weitergeleitet markiert.</div>' : "";
  const error = context.error ? `<div class="notice notice--error" role="alert">${escapeHtml(context.error)}</div>` : "";
  let handoffPanel = '<div class="handoff-state"><strong>Keine Übergabe möglich</strong><p>Dieser Eintrag enthält keine freigegebenen Kontaktdaten.</p></div>';
  if (lead.status === "handoff_created") {
    handoffPanel = '<div class="handoff-state handoff-state--done"><strong>An Noureen weitergeleitet</strong><p>Die Übergabe ist bereits im Verlauf dokumentiert.</p></div>';
  } else if (lead.status === "contact_requested" && lead.consent_to_contact && csrfToken) {
    handoffPanel = `<form method="post" action="./${encodeURIComponent(lead.id)}/handoff" aria-describedby="handoff-note">
      <input type="hidden" name="csrf_token" value="${escapeHtml(csrfToken)}">
      <button type="submit" name="confirmation" value="handoff">Als an Noureen weitergeleitet markieren</button>
      <p id="handoff-note">Erst anklicken, nachdem du die Kontaktdaten tatsächlich weitergeleitet hast.</p>
    </form>`;
  } else if (lead.consent_to_contact) {
    handoffPanel = '<div class="handoff-state"><strong>Kein offener Übergabeschritt</strong><p>Der aktuelle Status wird im Aktivitätsverlauf angezeigt.</p></div>';
  }

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#eef3f1"><title>Lead prüfen · Wisy Leads</title><style>
  :root{color-scheme:light;--ink:#18201d;--muted:#66736f;--line:#dfe6e2;--paper:#f7f8f7;--surface:#fff;--mineral:#315d52;--champagne:#b99b6b;--success:#386449;--error:#8f4038}*{box-sizing:border-box}body{margin:0;color:var(--ink);font:15px/1.5 "Avenir Next",Avenir,"Segoe UI",sans-serif;background:linear-gradient(180deg,#eef3f1,transparent 270px),var(--paper);overflow-wrap:anywhere}a,button{touch-action:manipulation}.shell{width:min(1040px,calc(100% - 40px));margin:auto;padding:34px 0 70px}.back{display:inline-block;margin-bottom:28px;color:var(--mineral);font-weight:700;text-decoration:none}.record-head{display:flex;justify-content:space-between;gap:24px;align-items:end;margin-bottom:24px}.eyebrow,dt{font:700 10px/1.3 "SFMono-Regular",Consolas,monospace;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}h1{font:500 clamp(36px,6vw,62px)/.98 "Iowan Old Style",Baskerville,serif;letter-spacing:-.035em;margin:5px 0}.record-head p{margin:0;color:var(--muted)}.badge{display:inline-block;padding:6px 11px;border-radius:999px;background:#e7efec;color:var(--mineral);font-weight:700}.layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:22px}.card{background:var(--surface);border:1px solid var(--line);border-radius:20px;box-shadow:0 12px 35px rgba(24,32,29,.055)}.identity,.timeline-card{padding:26px}.identity h2,.timeline-card h2{font:500 25px/1.15 "Iowan Old Style",Baskerville,serif;margin:0 0 20px}.contact{padding:20px 26px;background:#fafcfb;border-block:1px solid var(--line)}.contact a{display:inline-block;color:var(--mineral);font-weight:700}.facts{display:grid;grid-template-columns:repeat(2,1fr);gap:22px;padding:25px;margin:0}.facts dd{margin:5px 0 0;font-weight:650}.handoff{position:relative;background:var(--ink);color:#fff;padding:27px;border-radius:20px;overflow:hidden}.handoff:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--champagne)}.handoff h2{font:500 28px/1.1 "Iowan Old Style",Baskerville,serif;margin:0 0 8px}.handoff>p,.handoff form p,.handoff-state p{color:#bdcac5;font-size:13px;margin:0 0 20px}.handoff form{margin-top:22px}.handoff button{width:100%;min-height:48px;padding:10px 16px;border:0;border-radius:999px;background:#fff;color:var(--ink);font:700 14px/1.2 "Avenir Next",Avenir,sans-serif;cursor:pointer}.handoff form p{margin:10px 4px 0}.handoff-state{margin-top:22px;padding:16px;border:1px solid rgba(255,255,255,.16);border-radius:13px}.handoff-state strong{display:block;margin-bottom:4px}.handoff-state p{margin:0}.handoff-state--done{background:rgba(255,255,255,.08)}.notice{padding:13px 16px;border-radius:11px;margin-bottom:18px;background:#e5f0e8;color:var(--success);font-weight:700}.notice--error{background:#f5e8e5;color:var(--error)}.timeline-card{margin-top:22px}.timeline{list-style:none;padding:0;margin:0}.timeline li{display:grid;grid-template-columns:18px 1fr;gap:12px;position:relative;padding-bottom:24px}.timeline li:not(:last-child):before{content:"";position:absolute;left:5px;top:13px;bottom:0;width:1px;background:var(--line)}.timeline-dot{width:11px;height:11px;margin-top:5px;border-radius:50%;background:var(--mineral);z-index:1}.timeline strong{font-size:14px}.timeline p{margin:2px 0;color:var(--muted);font-size:12px}details summary{cursor:pointer;color:var(--muted);font-size:12px}details code{display:block;margin-top:6px;overflow-wrap:anywhere;font:11px/1.45 "SFMono-Regular",Consolas,monospace;color:var(--muted)}a:focus-visible,button:focus-visible,summary:focus-visible{outline:3px solid rgba(185,155,107,.58);outline-offset:3px}@media(max-width:760px){.shell{width:calc(100% - 24px);padding-top:20px}.record-head{display:block}.record-head .badge{margin-top:14px}.layout{grid-template-columns:1fr}.facts{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style></head><body><main class="shell"><a class="back" href="../?view=actionable">← Zur Arbeitsliste</a><header class="record-head"><div><div class="eyebrow"><span translate="no">PDB Aesthetic Room</span> · Lead prüfen</div><h1>${dashboardValue(leadTopic(lead))}</h1><p>Zuletzt aktiv: ${dashboardDate(lead.last_activity_at)}</p></div>${statusBadge(lead)}</header>${success}${error}<div class="layout"><div><section class="card"><div class="identity"><h2>Kontakt und Kontext</h2></div><div class="contact">${contactDetails(lead)}</div><dl class="facts"><div><dt>Interesse</dt><dd>${dashboardLabel(INTENT_LABELS, lead.intent)}</dd></div><div><dt>Quelle</dt><dd>${dashboardValue(lead.source)}</dd></div><div><dt>Letzter Schritt</dt><dd>${dashboardLabel(EVENT_LABELS, lead.latest_event_type)}</dd></div><div><dt>Referenz</dt><dd>${technicalReference(lead)}</dd></div></dl></section><section class="card timeline-card"><h2>Aktivitätsverlauf</h2><ol class="timeline">${timeline}</ol></section></div><aside><section class="handoff"><h2>Übergabe an Noureen</h2><p>Leite die freigegebenen Kontaktdaten über euren vereinbarten internen Weg weiter.</p>${handoffPanel}</section></aside></div></main></body></html>`;
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

function isSameOriginPost(req) {
  const origin = req.get("origin");
  const fetchSite = req.get("sec-fetch-site");
  if (!origin || (fetchSite && !["same-origin", "none"].includes(fetchSite))) return false;
  try {
    const parsed = new URL(origin);
    return parsed.protocol === `${req.protocol}:` && parsed.host === req.get("host");
  } catch {
    return false;
  }
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
  router.use(express.urlencoded({ extended: false, limit: "8kb" }));

  router.get("/", async (req, res) => {
    try {
      const data = await loadLeadDashboard(pool, req.query.limit);
      return res.type("html").send(renderLeadDashboard(data, {
        status: req.query.status,
        view: req.query.view,
      }));
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
  router.get("/lead/:leadId", async (req, res) => {
    const leadId = Number.parseInt(req.params.leadId, 10);
    if (!Number.isInteger(leadId) || leadId < 1) return res.status(404).send("Lead nicht gefunden");
    try {
      const record = await loadLeadRecord(pool, leadId);
      if (!record) return res.status(404).send("Lead nicht gefunden");
      return res.type("html").send(renderLeadRecord(record, {
        csrfToken: createCsrfToken(DASHBOARD_USERNAME, adminPassword),
        saved: req.query.saved === "1",
      }));
    } catch (error) {
      console.error("Wisy lead record failed:", error.name || "Error");
      return res.status(500).send("Lead konnte nicht geladen werden");
    }
  });
  router.post("/lead/:leadId/handoff", async (req, res) => {
    if (!isSameOriginPost(req)
      || !verifyCsrfToken(req.body?.csrf_token, DASHBOARD_USERNAME, adminPassword)) {
      return res.status(403).send("Sicherheitsprüfung fehlgeschlagen");
    }
    if (req.body?.confirmation !== "handoff") return res.status(400).send("Bestätigung fehlt");
    const leadId = Number.parseInt(req.params.leadId, 10);
    if (!Number.isInteger(leadId) || leadId < 1) return res.status(404).send("Lead nicht gefunden");
    try {
      const result = await markLeadHandedOff(pool, leadId);
      if (result.ok) return res.redirect(303, `../${leadId}?saved=1`);
      if (result.error === "not_found") return res.status(404).send("Lead nicht gefunden");
      const record = await loadLeadRecord(pool, leadId);
      if (!record) return res.status(404).send("Lead nicht gefunden");
      const message = result.error === "not_contactable"
        ? "Dieser Lead enthält keine freigegebenen Kontaktdaten."
        : "Dieser Lead kann im aktuellen Status nicht übergeben werden.";
      return res.status(409).type("html").send(renderLeadRecord(record, {
        csrfToken: createCsrfToken(DASHBOARD_USERNAME, adminPassword),
        error: message,
      }));
    } catch (error) {
      console.error("Wisy lead handoff failed:", error.name || "Error");
      return res.status(500).send("Übergabe konnte nicht gespeichert werden");
    }
  });

  return router;
}
