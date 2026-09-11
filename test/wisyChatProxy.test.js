import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import {
  classifyLeadIntent,
  createFixedWindowRateLimiter,
  createWisyChatProxyRouter,
  deriveLeadNotificationUrl,
  sanitizeChatResponse,
  tryNotifyContact,
  tryRecordLeadIntent,
  validateContactCapturePayload,
  validateCtaEventPayload,
  validateChatPayload,
} from "../wisyChatProxy.js";

test("accepts the Shopify chat request shape", () => {
  const result = validateChatPayload({
    session_id: "123e4567-e89b-12d3-a456-426614174000",
    query: "Welche Behandlung passt zu mir?",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.query, "Welche Behandlung passt zu mir?");
});

test("rejects missing or malformed sessions", () => {
  assert.deepEqual(
    validateChatPayload({ query: "Hallo", session_id: "!" }),
    { ok: false, error: "invalid_session_id" },
  );
});

test("accepts only safe storefront CTA events", () => {
  const result = validateCtaEventPayload({
    session_id: "session-123",
    target: "https://palaisdebeaute.de/pages/contact?from=wisy#form",
  }, "https://palaisdebeaute.de");

  assert.deepEqual(result, {
    ok: true,
    value: {
      sessionId: "session-123",
      route: "contact",
      target: "https://palaisdebeaute.de/pages/contact?from=wisy",
    },
  });
  assert.deepEqual(
    validateCtaEventPayload({ session_id: "session-123", target: "https://evil.example/products/test" }, "https://palaisdebeaute.de"),
    { ok: false, error: "invalid_target" },
  );
  assert.deepEqual(
    validateCtaEventPayload({ session_id: "session-123", target: "https://palaisdebeaute.de/products/test" }, "https://evil.example"),
    { ok: false, error: "origin_not_allowed" },
  );
});

test("accepts contact details only with explicit versioned consent", () => {
  const accepted = validateContactCapturePayload({
    session_id: "session-123",
    consent_to_contact: true,
    consent_version: "wisy-contact-v1-2026-09-11",
    contact: { name: "Testperson", email: "test@example.com" },
  }, "https://palaisdebeaute.de");
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.status, "contact_requested");
  assert.equal(accepted.value.contactEmail, "test@example.com");

  assert.deepEqual(validateContactCapturePayload({
    session_id: "session-123",
    consent_to_contact: false,
    consent_version: "wisy-contact-v1-2026-09-11",
    contact: { name: "Testperson", email: "test@example.com" },
  }, "https://palaisdebeaute.de"), { ok: false, error: "contact_requires_consent" });

  assert.deepEqual(validateContactCapturePayload({
    session_id: "session-123",
    consent_to_contact: true,
    consent_version: "wrong-version",
    contact: { name: "Testperson", phone: "+49 611 123456" },
  }, "https://palaisdebeaute.de"), { ok: false, error: "invalid_consent_version" });
});

test("derives the isolated lead notification webhook on the same n8n host", () => {
  assert.equal(
    deriveLeadNotificationUrl("https://example.n8n.cloud/webhook/wisy-secure?ignored=1"),
    "https://example.n8n.cloud/webhook/wisy-lead-notification",
  );
  assert.equal(deriveLeadNotificationUrl("https://evil.example/webhook/wisy"), null);
});

test("notifies internally without forwarding session or chat text", async () => {
  let request;
  const notified = await tryNotifyContact({
    webhookUrl: "https://example.n8n.cloud/webhook/wisy-secure",
    webhookSecret: "a".repeat(32),
    contact: { name: "Testperson", email: "test@example.com", phone: null },
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true };
    },
  });
  const body = JSON.parse(request.options.body);
  assert.equal(notified, true);
  assert.equal(request.url, "https://example.n8n.cloud/webhook/wisy-lead-notification");
  assert.equal(body.contact.email, "test@example.com");
  assert.equal("session_id" in body, false);
  assert.equal("message" in body, false);
});

test("records only a minimized CTA event from an allowed storefront", async (context) => {
  const recorded = [];
  const app = express();
  app.use(express.json());
  app.use("/api/wisy", createWisyChatProxyRouter({
    webhookUrl: "https://example.n8n.cloud/webhook/wisy-test",
    webhookSecret: "a".repeat(32),
    pool: {},
    recordLeadEventImpl: async (_pool, event) => recorded.push(event),
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const endpoint = `http://127.0.0.1:${server.address().port}/api/wisy/events`;
  const blocked = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
    body: JSON.stringify({
      session_id: "session-123",
      target: "https://palaisdebeaute.de/pages/contact",
    }),
  });
  assert.equal(blocked.status, 403);
  assert.equal(recorded.length, 0);

  const accepted = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://palaisdebeaute.de" },
    body: JSON.stringify({
      session_id: "session-123",
      target: "https://palaisdebeaute.de/products/hydrafacial?source=wisy",
      message: "must not be retained",
      contact: { email: "must-not-be-retained@example.com" },
    }),
  });
  assert.equal(accepted.status, 201);
  assert.deepEqual(recorded, [{
    sessionId: "session-123",
    eventType: "cta_clicked",
    status: "qualified",
    source: "shopify_wisy",
    intent: null,
    treatmentInterest: null,
    route: "treatment",
    ctaTarget: "https://palaisdebeaute.de/products/hydrafacial?source=wisy",
    consentToContact: false,
    consentVersion: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
  }]);
  assert.equal(JSON.stringify(recorded).includes("must not be retained"), false);
  assert.equal(JSON.stringify(recorded).includes("must-not-be-retained@example.com"), false);
});

test("stores a public contact request only after explicit consent", async (context) => {
  const recorded = [];
  const notifications = [];
  const app = express();
  app.use(express.json());
  app.use("/api/wisy", createWisyChatProxyRouter({
    webhookUrl: "https://example.n8n.cloud/webhook/wisy-test",
    webhookSecret: "a".repeat(32),
    pool: {},
    recordLeadEventImpl: async (_pool, event) => recorded.push(event),
    fetchImpl: async (url, options) => {
      notifications.push({ url, body: JSON.parse(options.body) });
      return { ok: true };
    },
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/wisy/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://palaisdebeaute.de" },
    body: JSON.stringify({
      session_id: "session-123",
      consent_to_contact: true,
      consent_version: "wisy-contact-v1-2026-09-11",
      contact: { name: "Testperson", email: "test@example.com" },
    }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { ok: true, notification_queued: true });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].eventType, "contact_submitted");
  assert.equal(recorded[0].status, "contact_requested");
  assert.equal(recorded[0].consentToContact, true);
  assert.equal(recorded[0].consentVersion, "wisy-contact-v1-2026-09-11");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].body.contact.email, "test@example.com");
});

test("limits upstream output to the supported response contract", () => {
  const result = sanitizeChatResponse({
    reply: "Antwort",
    buttons: [
      { label: "Beratung", value: "Ich möchte Beratung" },
      { label: "", value: "ungueltig" },
    ],
    unexpected: "not forwarded",
  }, "session-123");

  assert.deepEqual(result, {
    reply: "Antwort",
    buttons: [{ label: "Beratung", value: "Ich möchte Beratung" }],
    session_id: "session-123",
  });
});

test("returns only a fixed lead intent for the contact UI", () => {
  const result = sanitizeChatResponse({ reply: "Antwort" }, "session-123", "contact");
  assert.equal(result.lead_intent, "contact");
  assert.equal("lead_intent" in sanitizeChatResponse({ reply: "Antwort" }, "session-123", "unexpected"), false);
});

test("does not enable the proxy with incomplete server-only configuration", () => {
  assert.equal(createWisyChatProxyRouter({ webhookUrl: "", webhookSecret: "" }), null);
  assert.equal(createWisyChatProxyRouter({
    webhookUrl: "https://example.com/webhook",
    webhookSecret: "a".repeat(32),
  }), null);
});

test("rate limits repeated requests from one IP", () => {
  const limiter = createFixedWindowRateLimiter({ maxRequests: 2, windowMs: 60_000 });
  const req = { ip: "127.0.0.1" };
  let nextCalls = 0;
  const result = { status: null, body: null, headers: {} };
  const res = {
    set(name, value) { result.headers[name] = value; },
    status(value) { result.status = value; return this; },
    json(value) { result.body = value; return this; },
  };

  limiter(req, res, () => { nextCalls += 1; });
  limiter(req, res, () => { nextCalls += 1; });
  limiter(req, res, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(result.status, 429);
  assert.equal(result.body.error, "rate_limited");
  assert.ok(Number(result.headers["Retry-After"]) >= 1);
});

test("classifies sales intent without retaining the customer message", async () => {
  let recordedEvent;
  const query = "Wie teuer ist eine Behandlung und kann ich einen Termin buchen?";
  const recorded = await tryRecordLeadIntent({
    pool: {},
    query,
    sessionId: "session-123",
    recordLeadEventImpl: async (pool, event) => { recordedEvent = event; },
  });

  assert.equal(recorded, true);
  assert.equal(classifyLeadIntent(query), "booking");
  assert.equal(recordedEvent.intent, "booking");
  assert.equal(recordedEvent.eventType, "intent_detected");
  assert.equal(JSON.stringify(recordedEvent).includes(query), false);
});

test("does not interrupt chat handling when lead storage fails", async () => {
  const errors = [];
  const recorded = await tryRecordLeadIntent({
    pool: {},
    query: "Ich brauche Beratung",
    sessionId: "session-123",
    recordLeadEventImpl: async () => { throw new Error("database unavailable"); },
    logger: { error: (...args) => errors.push(args) },
  });

  assert.equal(recorded, false);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].includes("database unavailable"), false);
});
