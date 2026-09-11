import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyLeadIntent,
  createFixedWindowRateLimiter,
  createWisyChatProxyRouter,
  sanitizeChatResponse,
  tryRecordLeadIntent,
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
