-- Real, admin-triggered "cleaner is on the way" signal -- not GPS-based (no cleaner login
-- system exists yet). Additive enum values only.
ALTER TYPE "BookingStatus" ADD VALUE 'ON_THE_WAY' AFTER 'SCHEDULED';
ALTER TYPE "AutomationEventType" ADD VALUE 'ON_THE_WAY_NOTICE';
