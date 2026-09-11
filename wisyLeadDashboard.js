import crypto from "node:crypto";
import { Router } from "express";
import { createFixedWindowRateLimiter } from "./wisyChatProxy.js";

const DASHBOARD_USERNAME = "wisy";
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

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
      ORDER BY lead.last_activity_at DESC
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

const DASHBOARD_HTML = `<!doctype html>
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
    .muted{color:var(--muted)}button,select{border:1px solid var(--line);background:#fff;border-radius:10px;padding:10px 13px;color:var(--ink)}button{cursor:pointer;background:var(--dark);color:#fff}
    .metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px;margin-bottom:18px}.metric{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px}.metric strong{display:block;font:600 28px Georgia,serif}.metric span{color:var(--muted);font-size:12px}
    .toolbar{display:flex;gap:10px;align-items:center;margin:18px 0}.table-wrap{overflow:auto;background:#fff;border:1px solid var(--line);border-radius:16px}table{width:100%;border-collapse:collapse;min-width:950px}th,td{text-align:left;padding:13px 14px;border-bottom:1px solid var(--line);vertical-align:top}th{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);background:#fffdfb;position:sticky;top:0}.badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#f1ebe6;font-size:12px}.contact{white-space:pre-line}.empty{padding:40px;text-align:center;color:var(--muted)}
    @media(max-width:800px){main{margin-top:24px}.metrics{grid-template-columns:repeat(2,1fr)}header{align-items:start;flex-direction:column}}
  </style>
</head>
<body>
<main>
  <header><div><div class="eyebrow">PDB Aesthetic Room</div><h1>Wisy Leads</h1><div class="muted" id="updated">Wird geladen …</div></div><button id="refresh" type="button">Aktualisieren</button></header>
  <section class="metrics" aria-label="Kennzahlen">
    <div class="metric"><strong id="total">–</strong><span>Leads gesamt</span></div>
    <div class="metric"><strong id="active">–</strong><span>Aktiv in 7 Tagen</span></div>
    <div class="metric"><strong id="actionable">–</strong><span>Handlungsrelevant</span></div>
    <div class="metric"><strong id="contactable">–</strong><span>Kontakt freigegeben</span></div>
    <div class="metric"><strong id="ctaClicks">–</strong><span>CTA-Klicks in 7 Tagen</span></div>
    <div class="metric"><strong id="booked">–</strong><span>Gebucht</span></div>
  </section>
  <div class="toolbar"><label for="status">Status:</label><select id="status"><option value="">Alle</option></select></div>
  <div class="table-wrap"><table><thead><tr><th>Letzte Aktivität</th><th>Status</th><th>Intent</th><th>Interesse</th><th>Letzter Schritt</th><th>CTA-Ziel</th><th>Kontakt</th><th>Session</th></tr></thead><tbody id="rows"></tbody></table><div class="empty" id="empty" hidden>Keine Leads für diesen Filter.</div></div>
</main>
<script>
  const state={leads:[]};
  const byId=(id)=>document.getElementById(id);
  const text=(value)=>value===null||value===undefined||value===""?"–":String(value);
  const date=(value)=>value?new Intl.DateTimeFormat("de-DE",{dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"–";
  function cell(row,value,className=""){const td=document.createElement("td");td.textContent=text(value);if(className)td.className=className;row.appendChild(td)}
  function linkCell(row,value){const td=document.createElement("td");if(value){const link=document.createElement("a");link.href=value;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Öffnen";td.appendChild(link)}else td.textContent="–";row.appendChild(td)}
  function render(){const body=byId("rows");body.replaceChildren();const filter=byId("status").value;const leads=state.leads.filter((lead)=>!filter||lead.status===filter);byId("empty").hidden=leads.length>0;for(const lead of leads){const row=document.createElement("tr");cell(row,date(lead.last_activity_at));const status=document.createElement("td");const badge=document.createElement("span");badge.className="badge";badge.textContent=text(lead.status);status.appendChild(badge);row.appendChild(status);cell(row,lead.intent);cell(row,lead.treatment_interest);cell(row,lead.latest_event_type);linkCell(row,lead.latest_cta_target);const contact=[lead.contact_name,lead.contact_email,lead.contact_phone].filter(Boolean).join("\n");cell(row,contact,"contact");cell(row,lead.session_id);body.appendChild(row)}}
  async function load(){byId("refresh").disabled=true;try{const response=await fetch("./api",{headers:{Accept:"application/json"},cache:"no-store"});if(!response.ok)throw new Error("dashboard_http_"+response.status);const data=await response.json();state.leads=data.leads;byId("total").textContent=data.summary.total;byId("active").textContent=data.summary.active_7d;byId("actionable").textContent=data.summary.actionable;byId("contactable").textContent=data.summary.contactable;byId("ctaClicks").textContent=data.summary.cta_clicks_7d;byId("booked").textContent=data.summary.booked;byId("updated").textContent="Stand: "+date(data.generated_at);const select=byId("status");const current=select.value;select.replaceChildren(new Option("Alle",""));for(const value of [...new Set(state.leads.map((lead)=>lead.status))].sort())select.add(new Option(value,value));select.value=current;render()}catch{byId("updated").textContent="Daten konnten nicht geladen werden."}finally{byId("refresh").disabled=false}}
  byId("status").addEventListener("change",render);byId("refresh").addEventListener("click",load);load();
</script>
</body>
</html>`;

function setDashboardSecurityHeaders(_req, res, next) {
  res.removeHeader("Access-Control-Allow-Origin");
  res.set({
    "Cache-Control": "no-store, max-age=0",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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

  router.get("/", (_req, res) => res.type("html").send(DASHBOARD_HTML));
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
