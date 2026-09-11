BEGIN;

CREATE TABLE IF NOT EXISTS wisy_leads (
  id BIGSERIAL PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL UNIQUE,
  source VARCHAR(64) NOT NULL DEFAULT 'shopify_wisy',
  status VARCHAR(32) NOT NULL DEFAULT 'new'
    CHECK (status IN (
      'new',
      'qualified',
      'contact_requested',
      'handoff_created',
      'booking_started',
      'booked',
      'closed_lost'
    )),
  intent VARCHAR(64),
  treatment_interest VARCHAR(160),
  contact_name VARCHAR(160),
  contact_email VARCHAR(320),
  contact_phone VARCHAR(40),
  consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE,
  consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (
      consent_to_contact = FALSE
      AND consent_at IS NULL
      AND contact_name IS NULL
      AND contact_email IS NULL
      AND contact_phone IS NULL
    )
    OR
    (
      consent_to_contact = TRUE
      AND consent_at IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS wisy_lead_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES wisy_leads(id) ON DELETE CASCADE,
  event_type VARCHAR(48) NOT NULL
    CHECK (event_type IN (
      'session_started',
      'intent_detected',
      'recommendation_shown',
      'cta_shown',
      'cta_clicked',
      'contact_consent_granted',
      'contact_submitted',
      'handoff_created',
      'booking_started',
      'booked',
      'closed_lost'
    )),
  route VARCHAR(96),
  treatment_interest VARCHAR(160),
  cta_target VARCHAR(500),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS wisy_leads_status_last_activity_idx
  ON wisy_leads (status, last_activity_at DESC);

CREATE INDEX IF NOT EXISTS wisy_lead_events_lead_time_idx
  ON wisy_lead_events (lead_id, occurred_at DESC);

COMMIT;
