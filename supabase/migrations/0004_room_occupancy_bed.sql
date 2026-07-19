-- ---------------------------------------------------------------------------
-- 0004 · Room-type occupancy + bed note (onboarding wizard redesign)
-- ---------------------------------------------------------------------------
-- The onboarding "Room types" step collects two extra per-room fields that the
-- original schema had no home for:
--   * max_occupancy — how many guests a room sleeps (shown on the booking page)
--   * bed_note       — free-text bed & size line, e.g. "1 king bed · 300 sq ft"
-- Both are additive with safe defaults, so existing rows keep working untouched.
-- REQUIRED for the onboarding wizard's occupancy / bed-size fields to persist.

alter table room_types
  add column if not exists max_occupancy int  not null default 2,
  add column if not exists bed_note      text not null default '';
