import { ROUTE_POLYLINE, STOPS, type RoutePoint } from "../data/route";

/**
 * Calculate distance between two points in km using Haversine formula.
 */
export function haversine(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sin2 =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(sin2));
}

/**
 * Calculates bearing angle in degrees [0, 360) from point a to point b.
 */
export function calculateBearing(a: RoutePoint, b: RoutePoint): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

// Cumulative distances along the polyline
const segLengths: number[] = [];
let totalLength = 0;
for (let i = 0; i < ROUTE_POLYLINE.length - 1; i++) {
  const d = haversine(ROUTE_POLYLINE[i], ROUTE_POLYLINE[i + 1]);
  segLengths.push(d);
  totalLength += d;
}

export const ROUTE_TOTAL_KM = totalLength;

/**
 * Given a progress fraction [0,1], return the interpolated lat/lng and heading bearing along the road polyline.
 */
export function lerpOnRoute(progress: number): RoutePoint {
  const target = Math.min(Math.max(progress, 0), 1) * totalLength;
  let accumulated = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const seg = segLengths[i];
    if (accumulated + seg >= target) {
      const t = seg > 0 ? (target - accumulated) / seg : 0;
      const a = ROUTE_POLYLINE[i];
      const b = ROUTE_POLYLINE[i + 1];
      const bearing = calculateBearing(a, b);
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        bearing,
      };
    }
    accumulated += seg;
  }
  const last = ROUTE_POLYLINE[ROUTE_POLYLINE.length - 1];
  const prev = ROUTE_POLYLINE[ROUTE_POLYLINE.length - 2] || last;
  return { ...last, bearing: calculateBearing(prev, last) };
}

/**
 * Find the distance (km) from a point on the route (by progress) to a given stop.
 * Returns the remaining road distance the bus still has to travel.
 */
export function distanceToStop(busProgress: number, stopId: string): number {
  const stop = STOPS.find((s) => s.id === stopId);
  if (!stop) return 0;

  // Find closest polyline index for this stop
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < ROUTE_POLYLINE.length; i++) {
    const d = haversine(ROUTE_POLYLINE[i], stop);
    if (d < minDist) {
      minDist = d;
      closest = i;
    }
  }

  // Cumulative distance to that index
  let stopDist = 0;
  for (let i = 0; i < closest; i++) stopDist += segLengths[i];

  const busDist = busProgress * totalLength;
  const remaining = stopDist - busDist;
  return Math.max(0, remaining);
}

/** ETA in minutes given remaining km at DEMO_SPEED_KMH */
export const DEMO_SPEED_KMH = 25;
export function etaMinutes(remainingKm: number): number {
  return (remainingKm / DEMO_SPEED_KMH) * 60;
}

/**
 * Splits ROUTE_POLYLINE into covered and remaining segments based on progress [0, 1] and busPos.
 */
export function getRouteSegments(progress: number, busPos: RoutePoint): {
  covered: RoutePoint[];
  remaining: RoutePoint[];
} {
  const target = Math.min(Math.max(progress, 0), 1) * totalLength;
  let accumulated = 0;
  let splitIndex = 0;

  for (let i = 0; i < segLengths.length; i++) {
    const seg = segLengths[i];
    if (accumulated + seg >= target) {
      splitIndex = i;
      break;
    }
    accumulated += seg;
  }

  const covered: RoutePoint[] = [...ROUTE_POLYLINE.slice(0, splitIndex + 1), busPos];
  const remaining: RoutePoint[] = [busPos, ...ROUTE_POLYLINE.slice(splitIndex + 1)];

  return { covered, remaining };
}
