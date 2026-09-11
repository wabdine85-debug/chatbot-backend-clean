import { Router } from "express";
import { recordLeadEvent, validateLeadEventPayload } from "./leadTracking.js";

const DEFAULT_RATE_LIMIT = 30;
const DEFAULT_RATE_WINDOW_MS = 60_000;
export const CONTACT_CONSENT_VERSION = "wisy-contact-v1-2026-09-11";
const ALLOWED_STOREFRONT_ORIGINS = new Set([
  "https://palaisdebeaute.de",
  "https://www.palaisdebeaute.de",
  "https://padebeeeee.myshopify.com",
]);

function text(value, maxLength) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function validateChatPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }

  const query = text(body.query ?? body.message, 600);
  const sessionId = text(body.session_id ?? body.sessionId, 128);
  if (!query) return { ok: false, error: "query_required" };
  if (!sessionId || !/^[A-Za-z0-9_-]{6,128}$/.test(sessionId)) {
    return { ok: false, error: "invalid_session_id" };
  }

  return { ok: true, value: { query, sessionId } };
}

export function validateCtaEventPayload(body, origin) {
  if (!ALLOWED_STOREFRONT_ORIGINS.has(origin)) {
    return { ok: false, error: "origin_not_allowed" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }

  const sessionId = text(body.session_id ?? body.sessionId, 128);
  if (!sessionId || !/^[A-Za-z0-9_-]{6,128}$/.test(sessionId)) {
    return { ok: false, error: "invalid_session_id" };
  }

  try {
    const target = new URL(text(body.target, 500));
    const allowedHost = target.hostname === "palaisdebeaute.de"
      || target.hostname === "www.palaisdebeaute.de";
    const allowedPath = target.pathname.startsWith("/products/")
      || target.pathname.startsWith("/collections/")
      || target.pathname === "/pages/contact"
      || target.pathname === "/pages/premium";
    if (target.protocol !== "https:" || !allowedHost || !allowedPath) {
      return { ok: false, error: "invalid_target" };
    }

    const route = target.pathname === "/pages/contact"
      ? "contact"
      : target.pathname === "/pages/premium"
        ? "premium"
        : "treatment";
    return {
      ok: true,
      value: {
        sessionId,
        route,
        target: `${target.origin}${target.pathname}${target.search}`,
      },
    };
  } catch {
    return { ok: false, error: "invalid_target" };
  }
}

export function validateContactCapturePayload(body, origin) {
  if (!ALLOWED_STOREFRONT_ORIGINS.has(origin)) {
    return { ok: false, error: "origin_not_allowed" };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_body" };
  }
  if (text(body.website, 200)) {
    return { ok: false, error: "invalid_submission" };
  }

  const result = validateLeadEventPayload({
    session_id: body.session_id ?? body.sessionId,
    event_type: "contact_submitted",
    status: "contact_requested",
    source: "shopify_wisy",
    route: "chat_contact_form_v1",
    consent_to_contact: body.consent_to_contact,
    consent_version: body.consent_version,
    contact: body.contact,
  });
  if (!result.ok) return result;
  if (!result.value.contactName) return { ok: false, error: "contact_name_required" };
  if (!result.value.contactEmail && !result.value.contactPhone) {
    return { ok: false, error: "contact_method_required" };
  }
  if (result.value.consentVersion !== CONTACT_CONSENT_VERSION) {
    return { ok: false, error: "invalid_consent_version" };
  }
  return result;
}

export function sanitizeChatResponse(payload, sessionId, leadIntent = null) {
  const reply = text(payload?.reply, 12_000);
  const buttons = Array.isArray(payload?.buttons)
    ? payload.buttons
      .slice(0, 6)
      .map((button) => ({
        label: text(button?.label, 80),
        value: text(button?.value, 500),
      }))
      .filter((button) => button.label && button.value)
    : [];

  const response = {
    reply: reply ?? "Bitte versuchen Sie es erneut oder nutzen Sie unser Kontaktformular.",
    buttons,
    session_id: sessionId,
  };
  if (["booking", "contact", "price", "treatment", "general"].includes(leadIntent)) {
    response.lead_intent = leadIntent;
  }
  return response;
}

export function classifyLeadIntent(query) {
  const normalized = query
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9€ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (/\b(buchen|buchung|termin|appointment)\b/.test(normalized)) return "booking";
  if (/\b(kontakt|anrufen|ruckruf|email|e mail|telefon|beratung)\b/.test(normalized)) return "contact";
  if (/\b(preis|preise|kostet|kosten|teuer|euro)\b|€/.test(normalized)) return "price";
  if (/\b(behandlung|hydrafacial|laser|botox|filler|microneedling|exosom|hautanalyse)\b/.test(normalized)) {
    return "treatment";
  }
  return "general";
}

export async function tryRecordLeadIntent({
  pool,
  query,
  sessionId,
  recordLeadEventImpl = recordLeadEvent,
  logger = console,
}) {
  if (!pool) return false;

  try {
    await recordLeadEventImpl(pool, {
      sessionId,
      eventType: "intent_detected",
      status: "qualified",
      source: "shopify_wisy",
      intent: classifyLeadIntent(query),
      treatmentInterest: null,
      route: "chat_proxy",
      ctaTarget: null,
      consentToContact: false,
      consentVersion: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
    });
    return true;
  } catch (error) {
    logger.error("Wisy lead intent tracking failed:", error.name || "Error");
    return false;
  }
}

export function createFixedWindowRateLimiter({
  maxRequests = DEFAULT_RATE_LIMIT,
  windowMs = DEFAULT_RATE_WINDOW_MS,
} = {}) {
  const clients = new Map();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    const current = clients.get(key);

    if (!current || current.resetAt <= now) {
      clients.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ ok: false, error: "rate_limited" });
    }

    if (clients.size > 10_000) {
      for (const [clientKey, value] of clients) {
        if (value.resetAt <= now) clients.delete(clientKey);
      }
    }
    return next();
  };
}

function validWebhookUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && (parsed.hostname === "n8n.cloud" || parsed.hostname.endsWith(".n8n.cloud"));
  } catch (error) {
    return false;
  }
}

export function deriveLeadNotificationUrl(webhookUrl) {
  if (!validWebhookUrl(webhookUrl)) return null;
  const parsed = new URL(webhookUrl);
  parsed.pathname = "/webhook/wisy-lead-notification";
  parsed.search = "";
  parsed.hash = "";
  return parsed.href;
}

export async function tryNotifyContact({
  webhookUrl,
  webhookSecret,
  contact,
  fetchImpl = fetch,
  logger = console,
}) {
  const notificationUrl = deriveLeadNotificationUrl(webhookUrl);
  if (!notificationUrl || typeof webhookSecret !== "string" || webhookSecret.length < 32) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetchImpl(notificationUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Wisy-Webhook-Secret": webhookSecret,
      },
      body: JSON.stringify({
        event_type: "contact_submitted",
        consent_version: CONTACT_CONSENT_VERSION,
        contact,
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`notification_http_${response.status}`);
    return true;
  } catch (error) {
    logger.error("Wisy contact notification failed:", error.name || "Error");
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function createWisyChatProxyRouter({
  webhookUrl,
  webhookSecret,
  pool,
  fetchImpl = fetch,
  recordLeadEventImpl = recordLeadEvent,
}) {
  if (!validWebhookUrl(webhookUrl) || typeof webhookSecret !== "string" || webhookSecret.length < 32) {
    return null;
  }

  const router = Router();
  router.post("/chat", createFixedWindowRateLimiter(), async (req, res) => {
    const validation = validateChatPayload(req.body);
    if (!validation.ok) {
      return res.status(400).json({ ok: false, error: validation.error });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const upstream = await fetchImpl(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wisy-Webhook-Secret": webhookSecret,
        },
        body: JSON.stringify({
          session_id: validation.value.sessionId,
          query: validation.value.query,
        }),
        signal: controller.signal,
      });

      if (!upstream.ok) throw new Error(`upstream_http_${upstream.status}`);
      const result = await upstream.json();

      // Lead persistence must never add latency to the customer-facing reply.
      void tryRecordLeadIntent({
        pool,
        query: validation.value.query,
        sessionId: validation.value.sessionId,
        recordLeadEventImpl,
      });

      return res.json(sanitizeChatResponse(
        result,
        validation.value.sessionId,
        classifyLeadIntent(validation.value.query),
      ));
    } catch (error) {
      console.error("Wisy chat proxy failed:", error.name);
      return res.status(502).json({
        ok: false,
        error: "chat_unavailable",
        reply: "Wisy ist gerade nicht erreichbar. Bitte versuchen Sie es erneut oder nutzen Sie unser Kontaktformular.",
      });
    } finally {
      clearTimeout(timeout);
    }
  });

  router.post("/events", createFixedWindowRateLimiter(), async (req, res) => {
    const validation = validateCtaEventPayload(req.body, req.get("origin"));
    if (!validation.ok) {
      const status = validation.error === "origin_not_allowed" ? 403 : 400;
      return res.status(status).json({ ok: false, error: validation.error });
    }

    try {
      await recordLeadEventImpl(pool, {
        sessionId: validation.value.sessionId,
        eventType: "cta_clicked",
        status: "qualified",
        source: "shopify_wisy",
        intent: null,
        treatmentInterest: null,
        route: validation.value.route,
        ctaTarget: validation.value.target,
        consentToContact: false,
        consentVersion: null,
        contactName: null,
        contactEmail: null,
        contactPhone: null,
      });
      return res.status(201).json({ ok: true });
    } catch (error) {
      console.error("Wisy CTA tracking failed:", error.name || "Error");
      return res.status(500).json({ ok: false, error: "storage_failed" });
    }
  });

  router.post("/contact", createFixedWindowRateLimiter({ maxRequests: 10 }), async (req, res) => {
    const validation = validateContactCapturePayload(req.body, req.get("origin"));
    if (!validation.ok) {
      const status = validation.error === "origin_not_allowed" ? 403 : 400;
      return res.status(status).json({ ok: false, error: validation.error });
    }

    try {
      await recordLeadEventImpl(pool, validation.value);
      void tryNotifyContact({
        webhookUrl,
        webhookSecret,
        fetchImpl,
        contact: {
          name: validation.value.contactName,
          email: validation.value.contactEmail,
          phone: validation.value.contactPhone,
        },
      });
      return res.status(201).json({ ok: true });
    } catch (error) {
      console.error("Wisy contact capture failed:", error.name || "Error");
      return res.status(500).json({ ok: false, error: "storage_failed" });
    }
  });

  return router;
}
