-- PlanetPulse database schema
-- Run this in Supabase SQL editor before seeding

-- Enable pgcrypto for gen_random_uuid() (usually pre-enabled in Supabase)
create extension if not exists "pgcrypto";

-- Activity type enum
create type activity_type as enum (
  'car',
  'bus',
  'flight',
  'electricity',
  'veg_meal',
  'non_veg_meal'
);

-- Activities table
create table if not exists activities (
  id          uuid        primary key default gen_random_uuid(),
  type        activity_type not null,
  quantity    numeric     not null check (quantity > 0),
  co2_kg      numeric     not null check (co2_kg >= 0),
  date        date        not null default current_date,
  created_at  timestamptz not null default now()
);

-- Index for date-range queries (dashboard weekly view)
create index if not exists activities_date_idx on activities(date desc);
create index if not exists activities_type_idx on activities(type);

-- Settings table (single row, id=1)
create table if not exists settings (
  id                int         primary key default 1,
  weekly_target_kg  numeric     check (weekly_target_kg > 0)
);

-- Ensure single settings row exists
insert into settings(id, weekly_target_kg)
values (1, null)
on conflict (id) do nothing;

-- Enable Row Level Security (public read/write — no auth)
alter table activities enable row level security;
alter table settings enable row level security;

-- Allow all operations (no auth required per spec)
create policy "Allow all on activities" on activities
  for all using (true) with check (true);

create policy "Allow all on settings" on settings
  for all using (true) with check (true);
