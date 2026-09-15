-- PlanetPulse Seed Data
-- Current date: 2026-09-15 (Tuesday)
-- Current week (ISO): 2026-09-14 (Mon) to 2026-09-20 (Sun)
-- Last week: 2026-09-07 (Mon) to 2026-09-13 (Sun)
--
-- All co2_kg values are pre-computed using the exact emission factors:
--   car=0.20, bus=0.08, flight=0.25, electricity=0.80, veg_meal=0.5, non_veg_meal=2.0

-- ============================================================
-- THIS WEEK (2026-09-14 to 2026-09-15 so far)
-- ============================================================

insert into activities (type, quantity, co2_kg, date) values
  -- Monday 14 Sep
  ('car',          25,    5.000,  '2026-09-14'),   -- 25km car commute × 0.20
  ('non_veg_meal',  2,    4.000,  '2026-09-14'),   -- 2 non-veg meals × 2.0
  ('electricity',  12,    9.600,  '2026-09-14'),   -- 12 kWh × 0.80

  -- Tuesday 15 Sep (today)
  ('bus',          18,    1.440,  '2026-09-15'),   -- 18km bus × 0.08
  ('veg_meal',      3,    1.500,  '2026-09-15'),   -- 3 veg meals × 0.5
  ('flight',       45,   11.250,  '2026-09-15');   -- 45km flight × 0.25

-- ============================================================
-- LAST WEEK (2026-09-07 to 2026-09-13)
-- ============================================================

insert into activities (type, quantity, co2_kg, date) values
  -- Monday 7 Sep
  ('car',          40,    8.000,  '2026-09-07'),   -- 40km car × 0.20
  ('veg_meal',      2,    1.000,  '2026-09-07'),   -- 2 veg meals × 0.5

  -- Wednesday 9 Sep
  ('flight',      850,  212.500,  '2026-09-09'),   -- 850km flight × 0.25
  ('electricity',  20,   16.000,  '2026-09-09'),   -- 20 kWh × 0.80

  -- Thursday 10 Sep
  ('bus',          30,    2.400,  '2026-09-10'),   -- 30km bus × 0.08
  ('non_veg_meal',  3,    6.000,  '2026-09-10'),   -- 3 non-veg meals × 2.0

  -- Saturday 12 Sep
  ('car',          60,   12.000,  '2026-09-12'),   -- 60km weekend trip × 0.20
  ('veg_meal',      4,    2.000,  '2026-09-12'),   -- 4 veg meals × 0.5

  -- Sunday 13 Sep
  ('electricity',  15,   12.000,  '2026-09-13'),   -- 15 kWh × 0.80
  ('non_veg_meal',  1,    2.000,  '2026-09-13');   -- 1 non-veg meal × 2.0

-- Set a default weekly target of 30 kg
update settings set weekly_target_kg = 30 where id = 1;

-- Summary of THIS WEEK data (for verification):
-- car:          25 km  → 5.000 kg
-- non_veg_meal:  2     → 4.000 kg
-- electricity:  12 kWh → 9.600 kg
-- bus:          18 km  → 1.440 kg
-- veg_meal:      3     → 1.500 kg
-- flight:      450 km  → 112.500 kg
-- TOTAL THIS WEEK: 134.040 kg   (exceeds 30 kg target → triggers AI nudge)
