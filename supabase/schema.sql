-- CampusRide Database Schema & Seed Data
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

-- 1. Create table 'buses'
CREATE TABLE IF NOT EXISTS public.buses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route_name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL DEFAULT 18.5204,
  lng DOUBLE PRECISION NOT NULL DEFAULT 73.8567,
  crowd_level TEXT NOT NULL DEFAULT 'seats' CHECK (crowd_level IN ('seats', 'standing', 'full')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create table 'trip_logs'
CREATE TABLE IF NOT EXISTS public.trip_logs (
  id BIGSERIAL PRIMARY KEY,
  bus_id TEXT NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  stop_name TEXT NOT NULL,
  scheduled_time TIMESTAMPTZ NOT NULL,
  actual_time TIMESTAMPTZ NOT NULL,
  boarded_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.buses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_logs ENABLE ROW LEVEL SECURITY;

-- Hackathon policies: allow anonymous SELECT, INSERT, UPDATE
DROP POLICY IF EXISTS "Allow anon read buses" ON public.buses;
CREATE POLICY "Allow anon read buses" ON public.buses FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon insert buses" ON public.buses;
CREATE POLICY "Allow anon insert buses" ON public.buses FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update buses" ON public.buses;
CREATE POLICY "Allow anon update buses" ON public.buses FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon read trip_logs" ON public.trip_logs;
CREATE POLICY "Allow anon read trip_logs" ON public.trip_logs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow anon insert trip_logs" ON public.trip_logs;
CREATE POLICY "Allow anon insert trip_logs" ON public.trip_logs FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anon update trip_logs" ON public.trip_logs;
CREATE POLICY "Allow anon update trip_logs" ON public.trip_logs FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- 4. Enable Supabase Realtime for the buses table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'buses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.buses;
  END IF;
END $$;

-- 5. Seed Bus BUS-01
INSERT INTO public.buses (id, name, route_name, lat, lng, crowd_level, is_active, updated_at)
VALUES ('BUS-01', 'Campus Express', 'City Route 1', 18.5204, 73.8567, 'seats', false, NOW())
ON CONFLICT (id) DO UPDATE 
SET updated_at = NOW();

-- 6. Seed ~60 realistic trip_logs rows across 5 stops and different hours
-- Stops: 'City Bus Stand', 'Market Square', 'Residential Colony', 'Science Park Junction', 'College Main Gate'
TRUNCATE TABLE public.trip_logs;

INSERT INTO public.trip_logs (bus_id, stop_name, scheduled_time, actual_time, boarded_count, created_at)
VALUES
  -- Morning Peak (07:30 - 09:30) - Heavy college inbound rush
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '3 days' + INTERVAL '7 hour 30 min', NOW() - INTERVAL '3 days' + INTERVAL '7 hour 32 min', 24, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '3 days' + INTERVAL '7 hour 45 min', NOW() - INTERVAL '3 days' + INTERVAL '7 hour 49 min', 32, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '3 days' + INTERVAL '8 hour 00 min', NOW() - INTERVAL '3 days' + INTERVAL '8 hour 08 min', 28, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '3 days' + INTERVAL '8 hour 15 min', NOW() - INTERVAL '3 days' + INTERVAL '8 hour 25 min', 18, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '3 days' + INTERVAL '8 hour 30 min', NOW() - INTERVAL '3 days' + INTERVAL '8 hour 42 min', 5, NOW()),

  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '2 days' + INTERVAL '7 hour 30 min', NOW() - INTERVAL '2 days' + INTERVAL '7 hour 31 min', 26, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '2 days' + INTERVAL '7 hour 45 min', NOW() - INTERVAL '2 days' + INTERVAL '7 hour 52 min', 35, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '2 days' + INTERVAL '8 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '8 hour 09 min', 31, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '2 days' + INTERVAL '8 hour 15 min', NOW() - INTERVAL '2 days' + INTERVAL '8 hour 26 min', 20, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '2 days' + INTERVAL '8 hour 30 min', NOW() - INTERVAL '2 days' + INTERVAL '8 hour 44 min', 4, NOW()),

  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '1 days' + INTERVAL '7 hour 30 min', NOW() - INTERVAL '1 days' + INTERVAL '7 hour 33 min', 22, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '1 days' + INTERVAL '7 hour 45 min', NOW() - INTERVAL '1 days' + INTERVAL '7 hour 50 min', 38, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '1 days' + INTERVAL '8 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '8 hour 11 min', 29, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '1 days' + INTERVAL '8 hour 15 min', NOW() - INTERVAL '1 days' + INTERVAL '8 hour 24 min', 17, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '1 days' + INTERVAL '8 hour 30 min', NOW() - INTERVAL '1 days' + INTERVAL '8 hour 40 min', 6, NOW()),

  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '7 hour 30 min', NOW() - INTERVAL '7 hour 29 min', 25, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '7 hour 45 min', NOW() - INTERVAL '7 hour 53 min', 36, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '8 hour 00 min', NOW() - INTERVAL '8 hour 10 min', 33, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '8 hour 15 min', NOW() - INTERVAL '8 hour 27 min', 19, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '8 hour 30 min', NOW() - INTERVAL '8 hour 43 min', 5, NOW()),

  -- Midday Trips (10:00 - 12:30) - Moderate crowd, lesser delay
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '3 days' + INTERVAL '10 hour 00 min', NOW() - INTERVAL '3 days' + INTERVAL '10 hour 02 min', 12, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '3 days' + INTERVAL '10 hour 15 min', NOW() - INTERVAL '3 days' + INTERVAL '10 hour 18 min', 16, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '3 days' + INTERVAL '10 hour 30 min', NOW() - INTERVAL '3 days' + INTERVAL '10 hour 34 min', 14, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '3 days' + INTERVAL '10 hour 45 min', NOW() - INTERVAL '3 days' + INTERVAL '10 hour 48 min', 9, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '3 days' + INTERVAL '11 hour 00 min', NOW() - INTERVAL '3 days' + INTERVAL '11 hour 04 min', 2, NOW()),

  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '2 days' + INTERVAL '10 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '10 hour 01 min', 14, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '2 days' + INTERVAL '10 hour 15 min', NOW() - INTERVAL '2 days' + INTERVAL '10 hour 17 min', 19, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '2 days' + INTERVAL '10 hour 30 min', NOW() - INTERVAL '2 days' + INTERVAL '10 hour 33 min', 12, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '2 days' + INTERVAL '10 hour 45 min', NOW() - INTERVAL '2 days' + INTERVAL '10 hour 47 min', 8, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '2 days' + INTERVAL '11 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '11 hour 03 min', 3, NOW()),

  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '1 days' + INTERVAL '10 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '10 hour 02 min', 11, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '1 days' + INTERVAL '10 hour 15 min', NOW() - INTERVAL '1 days' + INTERVAL '10 hour 19 min', 17, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '1 days' + INTERVAL '10 hour 30 min', NOW() - INTERVAL '1 days' + INTERVAL '10 hour 35 min', 15, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '1 days' + INTERVAL '10 hour 45 min', NOW() - INTERVAL '1 days' + INTERVAL '10 hour 49 min', 10, NOW()),
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '1 days' + INTERVAL '11 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '11 hour 05 min', 2, NOW()),

  -- Afternoon / Evening Peak (14:30 - 17:30) - Outbound and lab batches
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '3 days' + INTERVAL '16 hour 00 min', NOW() - INTERVAL '3 days' + INTERVAL '16 hour 04 min', 34, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '3 days' + INTERVAL '16 hour 15 min', NOW() - INTERVAL '3 days' + INTERVAL '16 hour 22 min', 21, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '3 days' + INTERVAL '16 hour 30 min', NOW() - INTERVAL '3 days' + INTERVAL '16 hour 38 min', 19, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '3 days' + INTERVAL '16 hour 45 min', NOW() - INTERVAL '3 days' + INTERVAL '16 hour 56 min', 15, NOW()),
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '3 days' + INTERVAL '17 hour 00 min', NOW() - INTERVAL '3 days' + INTERVAL '17 hour 14 min', 8, NOW()),

  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '2 days' + INTERVAL '16 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '16 hour 05 min', 38, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '2 days' + INTERVAL '16 hour 15 min', NOW() - INTERVAL '2 days' + INTERVAL '16 hour 24 min', 25, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '2 days' + INTERVAL '16 hour 30 min', NOW() - INTERVAL '2 days' + INTERVAL '16 hour 41 min', 22, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '2 days' + INTERVAL '16 hour 45 min', NOW() - INTERVAL '2 days' + INTERVAL '16 hour 59 min', 18, NOW()),
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '2 days' + INTERVAL '17 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '17 hour 18 min', 7, NOW()),

  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '1 days' + INTERVAL '16 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '16 hour 03 min', 36, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '1 days' + INTERVAL '16 hour 15 min', NOW() - INTERVAL '1 days' + INTERVAL '16 hour 21 min', 23, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '1 days' + INTERVAL '16 hour 30 min', NOW() - INTERVAL '1 days' + INTERVAL '16 hour 39 min', 20, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '1 days' + INTERVAL '16 hour 45 min', NOW() - INTERVAL '1 days' + INTERVAL '16 hour 55 min', 16, NOW()),
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '1 days' + INTERVAL '17 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '17 hour 15 min', 9, NOW()),

  -- Late Evening (18:00 - 19:30)
  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '2 days' + INTERVAL '18 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '18 hour 02 min', 15, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '2 days' + INTERVAL '18 hour 15 min', NOW() - INTERVAL '2 days' + INTERVAL '18 hour 18 min', 11, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '2 days' + INTERVAL '18 hour 30 min', NOW() - INTERVAL '2 days' + INTERVAL '18 hour 34 min', 9, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '2 days' + INTERVAL '18 hour 45 min', NOW() - INTERVAL '2 days' + INTERVAL '18 hour 50 min', 7, NOW()),
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '2 days' + INTERVAL '19 hour 00 min', NOW() - INTERVAL '2 days' + INTERVAL '19 hour 06 min', 3, NOW()),

  ('BUS-01', 'College Main Gate',     NOW() - INTERVAL '1 days' + INTERVAL '18 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '18 hour 03 min', 18, NOW()),
  ('BUS-01', 'Science Park Junction', NOW() - INTERVAL '1 days' + INTERVAL '18 hour 15 min', NOW() - INTERVAL '1 days' + INTERVAL '18 hour 20 min', 13, NOW()),
  ('BUS-01', 'Residential Colony',    NOW() - INTERVAL '1 days' + INTERVAL '18 hour 30 min', NOW() - INTERVAL '1 days' + INTERVAL '18 hour 36 min', 10, NOW()),
  ('BUS-01', 'Market Square',         NOW() - INTERVAL '1 days' + INTERVAL '18 hour 45 min', NOW() - INTERVAL '1 days' + INTERVAL '18 hour 51 min', 8, NOW()),
  ('BUS-01', 'City Bus Stand',        NOW() - INTERVAL '1 days' + INTERVAL '19 hour 00 min', NOW() - INTERVAL '1 days' + INTERVAL '19 hour 07 min', 4, NOW());
