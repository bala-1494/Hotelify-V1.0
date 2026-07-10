-- Hotelify operations layer (owned by the operations half).
--
-- Adds booking-transition metadata, the physical-rooms status layer, a
-- notification queue, and the atomic inventory functions that own all
-- inventory-decrement logic. Run after 0001_foundation.sql.

-- ---------------------------------------------------------------------------
-- Booking transition / operations fields
-- ---------------------------------------------------------------------------
alter table bookings add column if not exists note           text;
alter table bookings add column if not exists decided_at     timestamptz;
alter table bookings add column if not exists decided_by     text;      -- staff email
alter table bookings add column if not exists reject_reason  text;
alter table bookings add column if not exists checkin_token  uuid;
alter table bookings add column if not exists checked_in_at  timestamptz;

create unique index if not exists bookings_checkin_token_idx
  on bookings (checkin_token) where checkin_token is not null;

-- ---------------------------------------------------------------------------
-- Physical rooms layer + housekeeping status (S2.7)
-- ---------------------------------------------------------------------------
do $$ begin
  create type room_status as enum ('dirty', 'cleaning', 'ready');
exception when duplicate_object then null; end $$;

alter table rooms add column if not exists status room_status not null default 'ready';

-- ---------------------------------------------------------------------------
-- Notification queue (guest notifications on accept/reject)
-- ---------------------------------------------------------------------------
create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    text not null references hotels(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete cascade,
  type        text not null,                    -- booking_confirmed | booking_rejected | booking_manual
  to_email    text not null,
  payload     jsonb not null default '{}',
  status      text not null default 'queued',   -- queued | sent | failed
  created_at  timestamptz not null default now()
);
alter table notifications enable row level security;

-- ---------------------------------------------------------------------------
-- Inventory-holding statuses: a booking in one of these consumes a unit of the
-- room type's inventory for its date span. Pending does NOT hold inventory.
-- ---------------------------------------------------------------------------
-- (confirmed, id_submitted, checked_in). 'completed' stays are in the past and
-- never overlap future spans, so they're excluded from live holds.

-- ---------------------------------------------------------------------------
-- accept_booking: atomically confirm a pending booking iff inventory is free
-- for its date span. Locks the room_type row so concurrent accepts can't
-- oversell. Returns (ok, reason, checkin_token).
-- ---------------------------------------------------------------------------
create or replace function accept_booking(p_booking_id uuid, p_actor text)
returns table (ok boolean, reason text, token uuid)
language plpgsql
as $$
declare
  b        bookings%rowtype;
  cap      int;
  held     int;
  new_tok  uuid;
begin
  select * into b from bookings where id = p_booking_id for update;
  if not found then
    return query select false, 'not_found', null::uuid; return;
  end if;
  if b.status <> 'pending' then
    return query select false, 'not_pending', null::uuid; return;
  end if;

  -- Serialize concurrent accepts for this room type.
  select total_inventory into cap from room_types where id = b.room_type_id for update;
  if cap is null then
    return query select false, 'no_room_type', null::uuid; return;
  end if;

  select count(*) into held
    from bookings
    where room_type_id = b.room_type_id
      and status in ('confirmed', 'id_submitted', 'checked_in')
      and check_in < b.check_out
      and check_out > b.check_in;

  if held >= cap then
    return query select false, 'full', null::uuid; return;
  end if;

  new_tok := gen_random_uuid();
  update bookings
    set status = 'confirmed',
        decided_at = now(),
        decided_by = p_actor,
        checkin_token = coalesce(checkin_token, new_tok)
    where id = p_booking_id;

  return query select true, null::text, (select checkin_token from bookings where id = p_booking_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- create_manual_booking: staff walk-in/phone booking. Inserts a CONFIRMED row
-- (skips pending) iff inventory is free. source='manual'. Returns
-- (ok, reason, booking_id).
-- ---------------------------------------------------------------------------
create or replace function create_manual_booking(
  p_hotel_id      text,
  p_room_type_id  uuid,
  p_guest_name    text,
  p_guest_email   text,
  p_check_in      date,
  p_check_out     date,
  p_view_option   text,
  p_meal_option   text,
  p_nights        int,
  p_total         numeric,
  p_note          text,
  p_actor         text
)
returns table (ok boolean, reason text, booking_id uuid)
language plpgsql
as $$
declare
  cap      int;
  held     int;
  new_id   uuid;
begin
  if p_check_out <= p_check_in then
    return query select false, 'bad_dates', null::uuid; return;
  end if;

  select total_inventory into cap from room_types
    where id = p_room_type_id and hotel_id = p_hotel_id for update;
  if cap is null then
    return query select false, 'no_room_type', null::uuid; return;
  end if;

  select count(*) into held
    from bookings
    where room_type_id = p_room_type_id
      and status in ('confirmed', 'id_submitted', 'checked_in')
      and check_in < p_check_out
      and check_out > p_check_in;

  if held >= cap then
    return query select false, 'full', null::uuid; return;
  end if;

  insert into bookings (
    hotel_id, room_type_id, status, source, guest_name, guest_email,
    check_in, check_out, view_option_id, meal_option_id, nights, total_price,
    note, decided_at, decided_by, checkin_token
  ) values (
    p_hotel_id, p_room_type_id, 'confirmed', 'manual', p_guest_name, p_guest_email,
    p_check_in, p_check_out, p_view_option, p_meal_option, p_nights, p_total,
    p_note, now(), p_actor, gen_random_uuid()
  ) returning id into new_id;

  return query select true, null::text, new_id;
end;
$$;
