# CampusRide — Real-Time Campus Bus Tracker

🏆 **2nd Runner-up, Problem Protocol** — IEEE Week Hackathon, IEEE Student Branch, Galgotias University (Sep 2026)

CampusRide shows students where their campus bus is right now, when it will reach their stop, and how crowded it is, so they stop waiting at stops without knowing when the bus will come.

## Features

**Student view**
- Live bus position on an OpenStreetMap route
- ETA to the selected stop
- Crowd level: seats available, standing only, or full
- "I'm waiting at this stop" button so drivers and admins can see demand
- Estimated bus position when the driver's network drops

**Driver view**
- Shares live location while a trip is active
- Updates crowd level
- Simulated network-drop mode for demos

**Admin view**
- Live fleet overview, stop-wise demand alerts, and delays
- Trip analytics charts

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Maps | Leaflet, React-Leaflet, OpenStreetMap |
| Backend and database | Supabase (PostgreSQL + Realtime channels) |
| Charts | Recharts |

## How It Works

1. The driver app sends the bus's location to Supabase.
2. Supabase Realtime pushes each update instantly to all student and admin screens.
3. The app calculates the remaining distance along the route with the haversine formula and converts it into an ETA.
4. If updates stop arriving, the student view estimates the bus position from its last known speed and shows the bus faded.

## Run Locally

```bash
git clone https://github.com/kmish9685/CampusRide.git
cd CampusRide
npm install
cp .env.example .env   # then add your own Supabase URL and anon key
npm run dev
```

Create the database tables by running `supabase/schema.sql` in the Supabase SQL Editor.

## Note

This was built during a hackathon. Database write access is open to make the demo easy to run. Before real use, driver and admin accounts should require login.

## Team

Built by Kuldeep Prasad Mishra and team. <!-- Add teammates' names and GitHub links here -->
