-- ===========================================================================
-- 011 · Personal guest invitation links (QR codes)
--
-- Every member gets one permanent, reusable invite token. The token identifies
-- the MEMBER, never a meeting — the guest picks the meeting themselves on the
-- public page, so the same printed QR code stays valid forever.
--
-- Run this whole file in the Supabase SQL editor. Safe to re-run.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. The token column.
-- ---------------------------------------------------------------------------
-- 8 random bytes rendered as 16 hex characters (64 bits). Unguessable in
-- practice, and short enough that the QR stays low-density and therefore
-- scannable from a phone screen held at arm's length across a noisy room.
--
-- Hex rather than base64 on purpose: no +/= characters to url-encode, and no
-- case sensitivity to lose if a token is ever read aloud or typed by hand.

create or replace function public.generate_invite_token()
returns text
language sql
volatile
as $$
  select encode(gen_random_bytes(8), 'hex');
$$;

alter table public.members
  add column if not exists invite_token text;

-- Backfill before adding the constraints, or existing rows would violate them.
-- Per-row default: a column default would give every backfilled row the SAME
-- token, since the default is evaluated once for an ALTER TABLE rewrite.
update public.members
   set invite_token = public.generate_invite_token()
 where invite_token is null;

alter table public.members
  alter column invite_token set default public.generate_invite_token(),
  alter column invite_token set not null;

-- Uniqueness is what makes the token safe to resolve a member from. Without
-- it a collision would silently credit a guest to the wrong person.
create unique index if not exists members_invite_token_idx
  on public.members (invite_token);


-- ---------------------------------------------------------------------------
-- 2. Guest self-registration columns.
-- ---------------------------------------------------------------------------
-- `source` separates a guest the member typed in themselves from one who
-- scanned the QR and registered. Both credit the member identically in the
-- Guests Invited tally; this only exists so the admin view can tell the two
-- apart, and so we can see whether the QR flow is actually being used.
alter table public.guest_invitations
  add column if not exists source text not null default 'member',
  add column if not exists guest_company text;

do $$
begin
  alter table public.guest_invitations
    add constraint guest_invitations_source_check
    check (source in ('member', 'guest_link'));
exception
  when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------------
-- 3. Stop the same guest registering twice for one meeting.
-- ---------------------------------------------------------------------------
-- The public page has no login, so a double-tap or a back-button resubmit is
-- the normal case, not the exceptional one. Enforced in the database rather
-- than only in the action, because two concurrent submits can both pass an
-- application-level "does it exist?" check before either has inserted.
--
-- Scoped to rows that HAVE a meeting: a member may legitimately record the
-- same person twice with no meeting chosen ("not sure yet") while they pin
-- down a date. Email is lowercased so casing cannot be used to slip past it.
create unique index if not exists guest_invitations_dedupe_idx
  on public.guest_invitations (inviter_user_id, lower(guest_email), meeting_uid)
  where meeting_uid is not null;


-- ---------------------------------------------------------------------------
-- 4. No new RLS policies — deliberately.
-- ---------------------------------------------------------------------------
-- The public guest page runs as `anon`, which has no select on `members` and
-- no insert on `guest_invitations`. Rather than open either up, the server
-- action resolves the token and writes the row with the service-role client,
-- after validating the meeting against the live calendar.
--
-- That keeps the blast radius small: `anon` still cannot read the member
-- directory (41 people's names, emails and companies) or list who has been
-- invited. If we had added an anon insert policy instead, anyone could write
-- arbitrary rows into the activity tally straight from the browser.


-- ---------------------------------------------------------------------------
-- 5. Check it worked.
-- ---------------------------------------------------------------------------
select
  count(*)                                        as members,
  count(invite_token)                             as with_token,
  count(distinct invite_token)                    as distinct_tokens
from public.members;
