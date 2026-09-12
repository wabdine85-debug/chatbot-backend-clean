import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import {
  createWisyLeadDashboardRouter,
  isValidBasicAuth,
  loadLeadDashboard,
  renderLeadDashboard,
  sanitizeDashboardLead,
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

test("loads aggregate metrics and clamps the result limit", async () => {
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
  assert.equal(result.leads.length, 1);
  assert.deepEqual(calls[1].values, [200]);
  assert.match(calls[1].sql, /WHEN lead\.status IN \('contact_requested', 'handoff_created', 'booking_started'\) THEN 0/);
  assert.equal(calls.some((call) => /messages|query\s+FROM/i.test(call.sql)), false);
});

test("renders dashboard data server-side without executable JavaScript", () => {
  const html = renderLeadDashboard({
    generated_at: "2026-09-11T20:53:10.482Z",
    summary: { total: 1, active_7d: 1, actionable: 0, contactable: 0, cta_clicks_7d: 0, booked: 0 },
    leads: [{
      session_id: "session-123",
      status: "qualified",
      intent: "<script>alert(1)</script>",
      contact_topic: "pricing_offer",
      preferred_contact_method: "email",
      consent_to_contact: true,
      contact_name: "Testperson",
      contact_email: "test@example.com",
      contact_phone: "+49 611 123456",
      latest_event_type: "intent_detected",
      latest_cta_target: null,
      last_activity_at: "2026-09-11T20:53:10.482Z",
    }],
  });

  assert.match(html, /Wisy Leads/);
  assert.match(html, /session-123/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /Wird geladen/);
  assert.match(html, /Preis \/ Angebot/);
  assert.match(html, /Gewünscht: E-Mail/);
  assert.match(html, /Interesse erkannt/);
  assert.match(html, /mailto:test@example\.com/);
  assert.match(html, /tel:\+49611123456/);
  assert.match(html, /<details><summary>Anzeigen<\/summary>/);
  assert.doesNotMatch(html, />qualified</);
  assert.doesNotMatch(html, />intent_detected</);
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
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const baseUrl = `http://127.0.0.1:${server.address().port}/wisy-admin`;
  const unauthorized = await fetch(baseUrl);
  assert.equal(unauthorized.status, 401);
  assert.match(unauthorized.headers.get("www-authenticate"), /^Basic /);

  const headers = { Authorization: basic("wisy", PASSWORD) };
  const page = await fetch(baseUrl, { headers });
  assert.equal(page.status, 200);
  assert.equal(page.headers.get("cache-control"), "no-store, max-age=0");
  assert.equal(page.headers.get("access-control-allow-origin"), null);
  assert.equal(page.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);
  assert.match(page.headers.get("content-security-policy"), /script-src 'none'/);
  const pageHtml = await page.text();
  assert.match(pageHtml, /Wisy Leads/);
  assert.match(pageHtml, /test-session/);
  assert.doesNotMatch(pageHtml, /Wird geladen/);

  const api = await fetch(`${baseUrl}/api`, { headers });
  assert.equal(api.status, 200);
  const payload = await api.json();
  assert.equal(payload.summary.total, 1);
  assert.equal(payload.leads[0].session_id, "test-session");
});
