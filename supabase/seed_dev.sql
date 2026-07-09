-- Dev-only seed for testing the operations flows without the storefront agent.
-- Adds sample staff memberships and MOCK pending/confirmed bookings to the
-- first onboarded hotel. Safe to run repeatedly. Run in the Supabase SQL editor
-- AFTER onboarding a hotel (so a hotel + room type exist).

do $$
declare
  h  text;
  rt uuid;
begin
  select id into h from hotels order by created_at limit 1;
  if h is null then
    raise notice 'No hotel found — onboard a hotel first, then re-run this seed.';
    return;
  end if;
  select id into rt from room_types where hotel_id = h order by sort_order limit 1;

  -- Sample staff; each joins the hotel with their role on next login.
  insert into memberships (hotel_id, user_email, role) values
    (h, 'manager@demo.com',      'manager'),
    (h, 'frontdesk@demo.com',    'front_desk'),
    (h, 'housekeeping@demo.com', 'housekeeping')
  on conflict (hotel_id, user_email) do nothing;

  if rt is not null then
    insert into bookings
      (hotel_id, room_type_id, status, source, guest_name, guest_email,
       check_in, check_out, nights, total_price, note)
    values
      (h, rt, 'pending',   'guest', 'Ava Guest',     'ava@example.com',  current_date + 2, current_date + 4, 2, 9000, 'Early check-in if possible'),
      (h, rt, 'pending',   'guest', 'Ben Traveler',  'ben@example.com',  current_date + 5, current_date + 6, 1, 4500, null),
      (h, rt, 'confirmed', 'guest', 'Cara Visitor',  'cara@example.com', current_date + 1, current_date + 3, 2, 9000, null);
  else
    raise notice 'Hotel % has no room types yet — add one, then re-run for mock bookings.', h;
  end if;
end $$;
