import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidBearerToken,
  recordLeadEvent,
  validateLeadEventPayload,
} from "../leadTracking.js";

test("accepts a structured anonymous lead event", () => {
  const result = validateLeadEventPayload({
    session_id: "123e4567-e89b-12d3-a456-426614174000",
    event_type: "intent_detected",
    intent: "beratung",
    treatment_interest: "HydraFacial",
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, "qualified");
  assert.equal(result.value.contactEmail, null);
});

test("rejects free chat text", () => {
  const result = validateLeadEventPayload({
    session_id: "123e4567-e89b-12d3-a456-426614174000",
    event_type: "intent_detected",
    message: "freie Kundennachricht",
  });

  assert.deepEqual(result, { ok: false, error: "free_text_not_allowed" });
});

test("rejects contact data without explicit consent", () => {
  const result = validateLeadEventPayload({
    session_id: "123e4567-e89b-12d3-a456-426614174000",
    event_type: "contact_submitted",
    contact: { email: "kunde@example.com" },
  });

  assert.deepEqual(result, { ok: false, error: "contact_requires_consent" });
});

test("accepts contact data with explicit consent", () => {
  const result = validateLeadEventPayload({
    session_id: "123e4567-e89b-12d3-a456-426614174000",
    event_type: "contact_submitted",
    consent_to_contact: true,
    consent_version: "wisy-contact-v2-2026-09-12",
    contact_topic: "appointment_consultation",
    preferred_contact_method: "email",
    contact: { email: "kunde@example.com" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.consentToContact, true);
});

test("compares bearer tokens without accepting malformed headers", () => {
  assert.equal(isValidBearerToken("Bearer correct-secret", "correct-secret"), true);
  assert.equal(isValidBearerToken("Bearer wrong-secret", "correct-secret"), false);
  assert.equal(isValidBearerToken("correct-secret", "correct-secret"), false);
});

test("stores a lead and its event in one transaction", async () => {
  const calls = [];
  const connection = {
    async query(sql, values) {
      calls.push({ sql, values });
      if (sql.includes("RETURNING id")) return { rows: [{ id: 42 }] };
      return { rows: [] };
    },
    release() { calls.push({ sql: "RELEASE" }); },
  };

  await recordLeadEvent({ connect: async () => connection }, {
    sessionId: "session-123",
    eventType: "intent_detected",
    status: "qualified",
    source: "shopify_wisy",
    intent: "booking",
    treatmentInterest: null,
    route: "chat_proxy",
    ctaTarget: null,
    consentToContact: false,
    consentVersion: null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    contactTopic: null,
    preferredContactMethod: null,
  });

  assert.equal(calls[0].sql, "BEGIN");
  assert.equal(calls.at(-2).sql, "COMMIT");
  assert.equal(calls.at(-1).sql, "RELEASE");
  assert.ok(calls.some((call) => call.sql.includes("INSERT INTO wisy_lead_events")));
});
