-- Additive localization persistence. Preview and production currently share the
-- same PostgreSQL database, so this migration intentionally performs no drops,
-- renames or destructive type changes.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultStaffLocale" TEXT NOT NULL DEFAULT 'ru';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "interfaceLocaleOverride" TEXT;

DO $$
DECLARE
  event_locale_existed BOOLEAN;
  order_locale_existed BOOLEAN;
  abandoned_locale_existed BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'Event'
       AND column_name = 'customerCommunicationLocale'
  ) INTO event_locale_existed;
  ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "customerCommunicationLocale" TEXT NOT NULL DEFAULT 'ru';

  IF NOT event_locale_existed AND to_regclass('"EventLanguageSettings"') IS NOT NULL THEN
    UPDATE "Event" e
       SET "customerCommunicationLocale" = CASE s."primaryLanguage"
         WHEN 'HE' THEN 'he'
         WHEN 'EN' THEN 'en'
         ELSE 'ru'
      END
      FROM "EventLanguageSettings" s
     WHERE s."eventId" = e."id";
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'Order'
       AND column_name = 'communicationLocale'
  ) INTO order_locale_existed;
  ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "communicationLocale" TEXT NOT NULL DEFAULT 'ru';

  IF NOT order_locale_existed THEN
    UPDATE "Order" o
       SET "communicationLocale" = e."customerCommunicationLocale"
      FROM "Event" e
     WHERE e."id" = o."eventId";
  END IF;

  IF to_regclass('"AbandonedCheckout"') IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'AbandonedCheckout'
         AND column_name = 'communicationLocale'
    ) INTO abandoned_locale_existed;
    ALTER TABLE "AbandonedCheckout" ADD COLUMN IF NOT EXISTS "communicationLocale" TEXT NOT NULL DEFAULT 'ru';
    IF NOT abandoned_locale_existed THEN
      UPDATE "AbandonedCheckout" c
         SET "communicationLocale" = e."customerCommunicationLocale"
        FROM "Event" e
       WHERE e."id" = c."eventId";
    END IF;
  END IF;
END $$;
