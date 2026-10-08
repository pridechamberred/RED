-- ===========================================================================
-- 021 · Admin approval for guest requests
--
-- Guests who self-register through a member's QR link (source = 'guest_link')
-- now need an admin to approve them before they appear on the meeting's
-- attendance register. Two new status values carry that decision:
--
--   pending  -> awaiting an admin (the existing default, unchanged)
--   approved -> shown on the register for that meeting
--   denied   -> kept for the record, never shown on the register
--
-- Member-entered guests (source = 'member') are unaffected and keep appearing
-- on the register as before.
--
-- The write is done by a server action with the service-role client after an
-- admin role + scope check, so no new RLS update policy is needed.
--
-- Run this whole file in the Supabase SQL editor. Safe to re-run.
-- ===========================================================================

alter table public.guest_invitations
  drop constraint if exists guest_invitations_status_check;

alter table public.guest_invitations
  add constraint guest_invitations_status_check
  check (status in ('pending', 'sent', 'accepted', 'declined', 'approved', 'denied'));

-- Check it worked.
select source, status, count(*) from public.guest_invitations group by 1, 2 order by 1, 2;
