-- PlanetPulse Database Migration: Routines, Habits, Goals, and Feedback
-- Supports Zero-Friction Tracking & Stateful Personal Sustainability Copilot

-- 1. Routines & Templates table
create table if not exists routines (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  type          activity_type not null,
  quantity      numeric not null check (quantity > 0),
  days_of_week  int[] default array[1,2,3,4,5], -- 1=Mon, ..., 7=Sun
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- 2. Habits and Goals table
create table if not exists habits (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      activity_type not null,
  target_action text not null,
  weekly_goal_count int not null default 3,
  completed_count   int not null default 0,
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- 3. Recommendation Feedback table
create table if not exists recommendation_feedback (
  id            uuid primary key default gen_random_uuid(),
  recommendation text not null,
  action        text not null check (action in ('accepted', 'dismissed', 'completed')),
  context_category text,
  created_at    timestamptz not null default now()
);

-- 4. Enable RLS
alter table routines enable row level security;
alter table habits enable row level security;
alter table recommendation_feedback enable row level security;

-- Policies for public demo access
create policy "Allow all on routines" on routines
  for all using (true) with check (true);

create policy "Allow all on habits" on habits
  for all using (true) with check (true);

create policy "Allow all on recommendation_feedback" on recommendation_feedback
  for all using (true) with check (true);
