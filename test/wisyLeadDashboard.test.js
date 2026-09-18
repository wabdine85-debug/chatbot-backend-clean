import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import {
  createCsrfToken,
  createWisyLeadDashboardRouter,
  isValidBasicAuth,
  loadLeadDashboard,
  markLeadHandedOff,
  renderLeadDashboard,
  renderLeadRecord,
  sanitizeDashboardLead,
  verifyCsrfToken,
} from "../wisyLeadDashboard.js";

const PASSWORD = "correct-horse-battery-staple";

function basic(username, password) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
}

test("accepts only the configured dashboard username and password", () => {
  assert.equal(isValidBasicAuth(basic("wisy", PASSWORD), PASSWORD), true);
  assert.equal(isValidBasicAuth(basic("admin", PASSWORD), PASSWORD), false);
  assert.equal(isValidBasicAuth(basic("wisy", "wrong-password-value"), PASSWORD), false);
  assert.equal(isValidBasicAuth("Bearer token", PASSWORD), false);
});

test("keeps the dashboard disabled without a strong separate password", () => {
  assert.equal(createWisyLeadDashboardRouter({ pool: {}, adminPassword: "short" }), null);
  assert.equal(createWisyLeadDashboardRouter({ pool: null, adminPassword: PASSWORD }), null);
});

test("binds an expiring CSRF token to the dashboard user", () => {
  const now = Date.parse("2026-09-13T10:00:00Z");
  const token = createCsrfToken("wisy", PASSWORD, now);
  assert.equal(verifyCsrfToken(token, "wisy", PASSWORD, now + 60_000), true);
  assert.equal(verifyCsrfToken(token, "other", PASSWORD, now + 60_000), false);
  assert.equal(verifyCsrfToken(token, "wisy", PASSWORD, now + 7_300_000), false);
});

test("never exposes contact fields without consent", () => {
  const lead = sanitizeDashboardLead({
    id: 1,
    session_id: "session-123",
    status: "qualified",
    consent_to_contact: false,
    contact_name: "Must not appear",
    contact_email: "hidden@example.com",
    contact_phone: "+49 123",
    contact_topic: "callback",
    preferred_contact_method: "phone",
    event_count: "2",
  });
  assert.equal(lead.contact_name, null);
  assert.equal(lead.contact_email, null);
  assert.equal(lead.contact_phone, null);
  assert.equal(lead.contact_topic, null);
  assert.equal(lead.preferred_contact_method, null);
  assert.equal(lead.event_count, 2);
});

test("loads aggregate metrics without requiring new database fields", async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("COUNT(*)::int AS total")) {
        return { rows: [{ total: 5, active_7d: 3, actionable: 2, booked: 1, contactable: 1, cta_clicks_7d: 4 }] };
      }
      return { rows: [{ id: 1, session_id: "session-123", consent_to_contact: true, event_count: 4 }] };
    },
  };
  const result = await loadLeadDashboard(pool, 9999);
  assert.deepEqual(result.summary, { total: 5, active_7d: 3, actionable: 2, booked: 1, contactable: 1, cta_clicks_7d: 4 });
  assert.deepEqual(calls[1].values, [200]);
  assert.match(calls[0].sql, /status IN \('contact_requested', 'handoff_created', 'booking_started'\)/);
  assert.equal(calls.some((call) => /assigned_to|next_action|wisy_lead_audit/i.test(call.sql)), false);
  assert.equal(calls.some((call) => /messages|query\s+FROM/i.test(call.sql)), false);
});

test("renders escaped dashboard data without executable JavaScript", () => {
  const html = renderLeadDashboard({
    generated_at: "2026-09-11T20:53:10.482Z",
    summary: { total: 1, active_7d: 1, actionable: 0, contactable: 1, cta_clicks_7d: 0, booked: 0 },
    leads: [{
      id: 1,
      session_id: "session-123",
      status: "qualified",
      intent: "price",
      contact_topic: "pricing_offer",
      preferred_contact_method: "email",
      consent_to_contact: true,
      contact_name: "<script>alert(1)</script>",
      contact_email: "test@example.com",
      contact_phone: "+49 611 123456",
      latest_event_type: "intent_detected",
      last_activity_at: "2026-09-11T20:53:10.482Z",
    }],
  });
  assert.match(html, /<h1>Wisy Leads<\/h1>/);
  assert.doesNotMatch(html, /Concierge/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /mailto:test%40example\.com/);
  assert.match(html, /Lead prüfen/);
  assert.match(html, /Stand: 11\.09\.26/);
});

test("keeps anonymous signals out of the actionable worklist", () => {
  const html = renderLeadDashboard({
    generated_at: "2026-09-13T08:00:00Z",
    summary: { total: 2, active_7d: 2, actionable: 1, contactable: 1, cta_clicks_7d: 0, booked: 0 },
    leads: [
      { id: 1, session_id: "contact", status: "contact_requested", intent: "contact", contact_topic: "callback", consent_to_contact: true, contact_name: "Testkontakt", contact_phone: "+49 611 1", latest_event_type: "contact_submitted" },
      { id: 2, session_id: "anonymous", status: "booking_started", intent: "booking", consent_to_contact: false, latest_event_type: "booking_started" },
    ],
  }, { view: "actionable" });
  assert.match(html, /Testkontakt/);
  assert.doesNotMatch(html, /anonymous/);
  assert.match(html, /1 Eintrag/);
});

test("marks a contact request as handed off in one transaction", async () => {
  const calls = [];
  const client = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("UPDATE wisy_leads")) return { rows: [{ id: 12 }] };
      return { rows: [] };
    },
    release() { calls.push({ sql: "RELEASE" }); },
  };
  const result = await markLeadHandedOff({ connect: async () => client }, 12);
  assert.deepEqual(result, { ok: true, alreadyDone: false });
  assert.equal(calls[0].sql, "BEGIN");
  assert.ok(calls.some((call) => call.sql.includes("status = 'handoff_created'")));
  assert.ok(calls.some((call) => call.sql.includes("INSERT INTO wisy_lead_events")));
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
});

test("treats an already handed-off lead idempotently", async () => {
  const client = {
    async query(sql) {
      if (sql.includes("UPDATE wisy_leads")) return { rows: [] };
      if (sql.includes("SELECT status")) return { rows: [{ status: "handoff_created", consent_to_contact: true }] };
      return { rows: [] };
    },
    release() {},
  };
  assert.deepEqual(await markLeadHandedOff({ connect: async () => client }, 12), { ok: true, alreadyDone: true });
});

test("renders one clear handoff action and no CRM fields", () => {
  const html = renderLeadRecord({
    lead: {
      id: 12,
      session_id: "session-12",
      source: "shopify_wisy",
      status: "contact_requested",
      intent: "contact",
      contact_topic: "appointment_consultation",
      consent_to_contact: true,
      contact_name: "Testperson",
      contact_email: "test@example.com",
      latest_event_type: "contact_submitted",
      last_activity_at: "2026-09-13T08:00:00Z",
    },
    events: [{ event_type: "contact_submitted", occurred_at: "2026-09-13T08:00:00Z", cta_target: null }],
  }, { csrfToken: "safe-token" });
  assert.match(html, /Übergabe an Noureen/);
  assert.match(html, /Als an Noureen weitergeleitet markieren/);
  assert.match(html, /name="csrf_token" value="safe-token"/);
  assert.match(html, /Aktivitätsverlauf/);
  assert.doesNotMatch(html, /Verantwortlich|Wiedervorlage|textarea|<script>/);
});

test("protects dashboard HTML and API with no-store security headers", async (context) => {
  const pool = {
    async query(sql) {
      if (sql.includes("COUNT(*)::int AS total")) {
        return { rows: [{ total: 1, active_7d: 1, actionable: 0, booked: 0, contactable: 0, cta_clicks_7d: 0 }] };
      }
      return { rows: [{ id: 1, session_id: "test-session", consent_to_contact: false, event_count: 1 }] };
    },
  };
  const app = express();
  app.use("/wisy-admin", createWisyLeadDashboardRouter({ pool, adminPassword: PASSWORD }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const baseUrl = `http://127.0.0.1:${server.address().port}/wisy-admin`;
  const unauthorized = await fetch(baseUrl);
  assert.equal(unauthorized.status, 401);
  const headers = { Authorization: basic("wisy", PASSWORD) };
  const page = await fetch(baseUrl, { headers });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(page.headers.get("access-control-allow-origin"), null);
  assert.match(page.headers.get("content-security-policy"), /script-src 'none'/);
  const api = await fetch(`${baseUrl}/api`, { headers });
  assert.equal(api.status, 200);
  assert.equal((await api.json()).summary.total, 1);
});

test("requires same-origin CSRF confirmation for handoff", async (context) => {
  const calls = [];
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("UPDATE wisy_leads")) return { rows: [{ id: 12 }] };
      return { rows: [] };
    },
    release() {},
  };
  const app = express();
  app.use("/wisy-admin", createWisyLeadDashboardRouter({
    pool: { connect: async () => client },
    adminPassword: PASSWORD,
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    Authorization: basic("wisy", PASSWORD),
    Origin: origin,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const rejected = await fetch(`${origin}/wisy-admin/lead/12/handoff`, {
    method: "POST",
    headers,
    body: new URLSearchParams({ confirmation: "handoff" }),
  });
  assert.equal(rejected.status, 403);

  const accepted = await fetch(`${origin}/wisy-admin/lead/12/handoff`, {
    method: "POST",
    redirect: "manual",
    headers,
    body: new URLSearchParams({
      csrf_token: createCsrfToken("wisy", PASSWORD),
      confirmation: "handoff",
    }),
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get("location"), "../12?saved=1");
  assert.ok(calls.some((sql) => sql.includes("INSERT INTO wisy_lead_events")));
});
