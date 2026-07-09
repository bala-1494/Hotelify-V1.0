-- Hotelify shared foundation schema.
--
-- This is the schema the guest/owner and operations halves of the app build
-- against. Run it against a fresh Supabase project (SQL editor or `supabase db
-- push`). All application access happens server-side through the service-role
-- key (see lib/supabase/server.ts), so RLS is enabled with no public policies:
-- the anon key can reach nothing directly.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Booking lifecycle. The guest/owner half only ever INSERTs 'pending' rows;
-- every transition beyond that is owned by the operations half.
do $$ begin
  create type booking_status as enum (
    'pending', 'confirmed', 'id_submitted', 'checked_in', 'completed',
    'rejected', 'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type member_role as enum ('owner', 'manager', 'front_desk', 'housekeeping');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Themes catalog (seeded presets; hotels reference one by key)
-- ---------------------------------------------------------------------------
create table if not exists themes (
  id          text primary key,           -- stable key, e.g. 'classic-red'
  name        text not null,
  primary     text not null,              -- hex, e.g. '#C41E3A'
  primary_dark text not null,
  accent      text not null,
  surface     text not null default '#ffffff',
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Hotels
-- ---------------------------------------------------------------------------
create table if not exists hotels (
  id             text primary key,        -- Google Place ID (or mock-* id)
  name           text not null,
  address        text not null default '',
  phone          text,
  website        text,
  description     text,
  price_level    int,
  rating         numeric,
  total_ratings  int,
  lat            double precision,
  lng            double precision,
  maps_url       text,
  types          text[] not null default '{}',
  reviews        jsonb  not null default '[]',
  subdomain      text not null unique,
  theme_id       text references themes(id),
  published      boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Memberships (who can operate which hotel, and in what role)
-- ---------------------------------------------------------------------------
create table if not exists memberships (
  id          uuid primary key default gen_random_uuid(),
  hotel_id    text not null references hotels(id) on delete cascade,
  user_email  text not null,
  role        member_role not null,
  created_at  timestamptz not null default now(),
  unique (hotel_id, user_email)
);

-- One hotel per owner: a given email can own at most one hotel.
create unique index if not exists memberships_one_owner_per_user
  on memberships (user_email)
  where role = 'owner';

-- ---------------------------------------------------------------------------
-- Room types (a bookable category; total_inventory rooms of this kind)
-- ---------------------------------------------------------------------------
create table if not exists room_types (
  id               uuid primary key default gen_random_uuid(),
  hotel_id         text not null references hotels(id) on delete cascade,
  name             text not null,
  base_price       numeric not null default 0,
  total_inventory  int not null default 1,
  amenities        text[] not null default '{}',
  view_options     jsonb not null default '[]',
  meal_options     jsonb not null default '[]',
  available        boolean not null default true,  -- owner availability toggle
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rooms (individual physical units; owned/managed by the operations half)
-- ---------------------------------------------------------------------------
create table if not exists rooms (
  id            uuid primary key default gen_random_uuid(),
  hotel_id      text not null references hotels(id) on delete cascade,
  room_type_id  uuid not null references room_types(id) on delete cascade,
  label         text not null,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Photos (gallery for the marketing + booking pages)
-- ---------------------------------------------------------------------------
create table if not exists photos (
  id           uuid primary key default gen_random_uuid(),
  hotel_id     text not null references hotels(id) on delete cascade,
  reference    text,                       -- Google photo_reference (source='google')
  url          text,                       -- storage URL (source='upload')
  source       text not null default 'google',  -- 'google' | 'upload'
  sort_order   int not null default 0,
  hidden       boolean not null default false,
  is_cover     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- At most one cover photo per hotel.
create unique index if not exists photos_one_cover_per_hotel
  on photos (hotel_id)
  where is_cover;

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------
create table if not exists bookings (
  id             uuid primary key default gen_random_uuid(),
  hotel_id       text not null references hotels(id) on delete cascade,
  room_type_id   uuid not null references room_types(id) on delete restrict,
  status         booking_status not null default 'pending',
  source         text not null default 'guest',   -- 'guest' | 'staff'
  guest_name     text not null,
  guest_email    text not null,
  check_in       date not null,
  check_out      date not null,
  view_option_id  text,
  meal_option_id  text,
  nights         int not null,
  total_price    numeric not null,
  created_at     timestamptz not null default now(),
  check (check_out > check_in)
);

-- Availability queries filter confirmed+ bookings by hotel/room/date range.
create index if not exists bookings_availability_idx
  on bookings (room_type_id, status, check_in, check_out);

-- ---------------------------------------------------------------------------
-- Row Level Security: lock everything; app uses the service role only.
-- ---------------------------------------------------------------------------
alter table themes      enable row level security;
alter table hotels      enable row level security;
alter table memberships enable row level security;
alter table room_types  enable row level security;
alter table rooms       enable row level security;
alter table photos      enable row level security;
alter table bookings    enable row level security;

-- ---------------------------------------------------------------------------
-- Seed theme presets
-- ---------------------------------------------------------------------------
insert into themes (id, name, "primary", primary_dark, accent, surface) values
  ('classic-red',   'Classic Red',   '#C41E3A', '#9E1830', '#F9E9EC', '#ffffff'),
  ('midnight-blue', 'Midnight Blue', '#1E3A8A', '#162C6B', '#E7ECFA', '#ffffff'),
  ('forest-green',  'Forest Green',  '#166534', '#0F4A25', '#E6F2EB', '#ffffff'),
  ('sunset-amber',  'Sunset Amber',  '#B45309', '#8A3F07', '#FBEEDD', '#ffffff'),
  ('slate-mono',    'Slate Mono',    '#334155', '#1E293B', '#EEF1F5', '#ffffff')
on conflict (id) do nothing;
