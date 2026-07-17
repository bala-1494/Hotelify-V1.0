-- Hotelify shared add-on pools (S1.7 revision — owned by the content half).
--
-- Before: every room_type carried its own view_options / meal_options JSON, so
-- the same "Sea View" or "Breakfast" surcharge had to be re-entered per room.
-- After: the View + Meal-plan pools are defined ONCE per hotel (a single price
-- per option) and each room type opts in to a subset by option id.
--
-- Run after 0002_operations.sql.

-- ---------------------------------------------------------------------------
-- 1. New columns: hotel-level pools + per-room opted-in id lists.
-- ---------------------------------------------------------------------------
alter table hotels
  add column if not exists view_options jsonb not null default '[]'::jsonb,
  add column if not exists meal_options jsonb not null default '[]'::jsonb;

alter table room_types
  add column if not exists view_option_ids jsonb not null default '[]'::jsonb,
  add column if not exists meal_option_ids jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Lift existing per-room options up to the hotel pool, de-duplicated by
--    label (earliest room by sort_order wins, keeping that option's id + price
--    so historical booking.view_option_id / meal_option_id keep resolving).
-- ---------------------------------------------------------------------------
with exploded as (
  select rt.hotel_id, rt.sort_order, o.value as opt, o.value->>'label' as label
  from room_types rt,
       lateral jsonb_array_elements(coalesce(rt.view_options, '[]'::jsonb)) o
),
ranked as (
  select *, row_number() over (partition by hotel_id, label order by sort_order) as rn
  from exploded
),
pool as (
  select hotel_id, jsonb_agg(opt order by sort_order) as arr
  from ranked where rn = 1 group by hotel_id
)
update hotels h set view_options = pool.arr from pool where pool.hotel_id = h.id;

with exploded as (
  select rt.hotel_id, rt.sort_order, o.value as opt, o.value->>'label' as label
  from room_types rt,
       lateral jsonb_array_elements(coalesce(rt.meal_options, '[]'::jsonb)) o
),
ranked as (
  select *, row_number() over (partition by hotel_id, label order by sort_order) as rn
  from exploded
),
pool as (
  select hotel_id, jsonb_agg(opt order by sort_order) as arr
  from ranked where rn = 1 group by hotel_id
)
update hotels h set meal_options = pool.arr from pool where pool.hotel_id = h.id;

-- ---------------------------------------------------------------------------
-- 3. Record each room's opted-in ids, mapped to the canonical (kept) id so a
--    room that had a duplicate-label option points at the pooled one.
-- ---------------------------------------------------------------------------
with exploded as (
  select rt.id as room_id, rt.hotel_id, rt.sort_order,
         o.value->>'id' as opt_id, o.value->>'label' as label
  from room_types rt,
       lateral jsonb_array_elements(coalesce(rt.view_options, '[]'::jsonb)) o
),
canonical as (
  select hotel_id, label, (array_agg(opt_id order by sort_order))[1] as canon_id
  from exploded group by hotel_id, label
),
room_ids as (
  select e.room_id, jsonb_agg(distinct c.canon_id) as ids
  from exploded e
  join canonical c on c.hotel_id = e.hotel_id and c.label = e.label
  group by e.room_id
)
update room_types rt set view_option_ids = room_ids.ids
from room_ids where room_ids.room_id = rt.id;

with exploded as (
  select rt.id as room_id, rt.hotel_id, rt.sort_order,
         o.value->>'id' as opt_id, o.value->>'label' as label
  from room_types rt,
       lateral jsonb_array_elements(coalesce(rt.meal_options, '[]'::jsonb)) o
),
canonical as (
  select hotel_id, label, (array_agg(opt_id order by sort_order))[1] as canon_id
  from exploded group by hotel_id, label
),
room_ids as (
  select e.room_id, jsonb_agg(distinct c.canon_id) as ids
  from exploded e
  join canonical c on c.hotel_id = e.hotel_id and c.label = e.label
  group by e.room_id
)
update room_types rt set meal_option_ids = room_ids.ids
from room_ids where room_ids.room_id = rt.id;

-- ---------------------------------------------------------------------------
-- 4. Drop the now-unused per-room option columns.
-- ---------------------------------------------------------------------------
alter table room_types drop column if exists view_options;
alter table room_types drop column if exists meal_options;
