import crypto from "node:crypto";
import { Router } from "express";

const EVENT_TYPES = new Set([
  "session_started",
  "intent_detected",
  "recommendation_shown",
  "cta_shown",
  "cta_clicked",
  "contact_consent_granted",
  "contact_submitted",
  "handoff_created",
  "booking_started",
  "booked",
  "closed_lost",
]);

const STATUSES = new Set([
  "new",
  "qualified",
  "contact_requested",
  "handoff_created",
  "booking_started",
  "booked",
  "closed_lost",
]);

const STATUS_BY_EVENT = {
  session_started: "new",
  intent_detected: "qualified",
  contact_consent_granted: "contact_requested",
  contact_submitted: "contact_requested",
  handoff_created: "handoff_created",
  booking_started: "booking_started",
  booked: "booked",
  closed_lost: "closed_lost",
};

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function validateLeadEventPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }

  if (["message", "messages", "query", "chat"].some((key) => key in body)) {
    return { ok: false, error: "free_text_not_allowed" };
  }

  const sessionId = optionalText(body.session_id, 128);
  if (!sessionId || !/^[A-Za-z0-9_-]{6,128}$/.test(sessionId)) {
    return { ok: false, error: "invalid_session_id" };
  }

  if (!EVENT_TYPES.has(body.event_type)) {
    return { ok: false, error: "invalid_event_type" };
  }

  const requestedStatus = body.status ?? STATUS_BY_EVENT[body.event_type] ?? "qualified";
  if (!STATUSES.has(requestedStatus)) {
    return { ok: false, error: "invalid_status" };
  }

  const consentToContact = body.consent_to_contact === true;
  const contact = body.contact && typeof body.contact === "object" ? body.contact : {};
  const contactName = optionalText(contact.name, 160);
  const contactEmail = optionalText(contact.email, 320);
  const contactPhone = optionalText(contact.phone, 40);

  if (!consentToContact && (contactName || contactEmail || contactPhone)) {
    return { ok: false, error: "contact_requires_consent" };
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "invalid_contact_email" };
  }
  if (contactPhone && !/^[+()0-9\s/-]{6,40}$/.test(contactPhone)) {
    return { ok: false, error: "invalid_contact_phone" };
  }

  return {
    ok: true,
    value: {
      sessionId,
      eventType: body.event_type,
      status: requestedStatus,
      source: optionalText(body.source, 64) ?? "shopify_wisy",
      intent: optionalText(body.intent, 64),
      treatmentInterest: optionalText(body.treatment_interest, 160),
      route: optionalText(body.route, 96),
      ctaTarget: optionalText(body.cta_target, 500),
      consentToContact,
      contactName,
      contactEmail,
      contactPhone,
    },
  };
}

export function isValidBearerToken(authorization, expectedToken) {
  if (!expectedToken || typeof authorization !== "string") return false;
  const prefix = "Bearer ";
  if (!authorization.startsWith(prefix)) return false;

  const received = Buffer.from(authorization.slice(prefix.length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export async function recordLeadEvent(pool, event) {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const leadResult = await connection.query(
      `
        INSERT INTO wisy_leads (
          session_id,
          source,
          status,
          intent,
          treatment_interest,
          contact_name,
          contact_email,
          contact_phone,
          consent_to_contact,
          consent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $9 THEN NOW() ELSE NULL END)
        ON CONFLICT (session_id) DO UPDATE SET
          source = EXCLUDED.source,
          status = CASE
            WHEN wisy_leads.status IN ('booked', 'closed_lost') THEN wisy_leads.status
            WHEN EXCLUDED.status IN ('booked', 'closed_lost') THEN EXCLUDED.status
            WHEN array_position(
              ARRAY['new', 'qualified', 'contact_requested', 'handoff_created', 'booking_started'],
              EXCLUDED.status
            ) > array_position(
              ARRAY['new', 'qualified', 'contact_requested', 'handoff_created', 'booking_started'],
              wisy_leads.status
            ) THEN EXCLUDED.status
            ELSE wisy_leads.status
          END,
          intent = COALESCE(EXCLUDED.intent, wisy_leads.intent),
          treatment_interest = COALESCE(EXCLUDED.treatment_interest, wisy_leads.treatment_interest),
          contact_name = COALESCE(EXCLUDED.contact_name, wisy_leads.contact_name),
          contact_email = COALESCE(EXCLUDED.contact_email, wisy_leads.contact_email),
          contact_phone = COALESCE(EXCLUDED.contact_phone, wisy_leads.contact_phone),
          consent_to_contact = wisy_leads.consent_to_contact OR EXCLUDED.consent_to_contact,
          consent_at = COALESCE(wisy_leads.consent_at, EXCLUDED.consent_at),
          updated_at = NOW(),
          last_activity_at = NOW()
        RETURNING id
      `,
      [
        event.sessionId,
        event.source,
        event.status,
        event.intent,
        event.treatmentInterest,
        event.contactName,
        event.contactEmail,
        event.contactPhone,
        event.consentToContact,
      ],
    );

    await connection.query(
      `
        INSERT INTO wisy_lead_events (
          lead_id,
          event_type,
          route,
          treatment_interest,
          cta_target
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        leadResult.rows[0].id,
        event.eventType,
        event.route,
        event.treatmentInterest,
        event.ctaTarget,
      ],
    );

    await connection.query("COMMIT");
  } catch (error) {
    try {
      await connection.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("Wisy lead tracking rollback failed:", rollbackError.name);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export function createWisyLeadRouter({ pool, sharedSecret }) {
  if (!sharedSecret) return null;

  const router = Router();
  router.post("/lead-events", async (req, res) => {
    if (!isValidBearerToken(req.get("authorization"), sharedSecret)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const validation = validateLeadEventPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: validation.error });
    }

    try {
      await recordLeadEvent(pool, validation.value);
      return res.status(201).json({ ok: true });
    } catch (error) {
      console.error("Wisy lead tracking failed:", error.message);
      return res.status(500).json({ ok: false, error: "storage_failed" });
    }
  });

  return router;
}
