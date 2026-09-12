BEGIN;

ALTER TABLE wisy_leads
  ADD COLUMN IF NOT EXISTS contact_topic VARCHAR(64),
  ADD COLUMN IF NOT EXISTS preferred_contact_method VARCHAR(16);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wisy_leads_contact_topic_check'
  ) THEN
    ALTER TABLE wisy_leads
      ADD CONSTRAINT wisy_leads_contact_topic_check
      CHECK (
        contact_topic IS NULL OR contact_topic IN (
          'appointment_consultation',
          'treatment_selection',
          'pricing_offer',
          'callback',
          'other'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'wisy_leads_preferred_contact_method_check'
  ) THEN
    ALTER TABLE wisy_leads
      ADD CONSTRAINT wisy_leads_preferred_contact_method_check
      CHECK (
        preferred_contact_method IS NULL OR preferred_contact_method IN (
          'email',
          'phone',
          'either'
        )
      );
  END IF;
END $$;

COMMIT;
