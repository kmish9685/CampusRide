// Route and stop data — replace with your real college coordinates
export interface Stop {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface RoutePoint {
  lat: number;
  lng: number;
}

// 5 stops along a ~5 km route ending at College Main Gate
// Using Pune coordinates as placeholders — replace with your campus area
export const STOPS: Stop[] = [
  { id: "stop-1", name: "City Bus Stand",        lat: 18.5204, lng: 73.8567 },
  { id: "stop-2", name: "Market Square",          lat: 18.5150, lng: 73.8490 },
  { id: "stop-3", name: "Residential Colony",     lat: 18.5080, lng: 73.8420 },
  { id: "stop-4", name: "Science Park Junction",  lat: 18.5010, lng: 73.8360 },
  { id: "stop-5", name: "College Main Gate",      lat: 18.4950, lng: 73.8300 },
];

// Polyline points for the bus route (includes intermediate points for smooth path)
export const ROUTE_POLYLINE: RoutePoint[] = [
  { lat: 18.5204, lng: 73.8567 },
  { lat: 18.5185, lng: 73.8545 },
  { lat: 18.5165, lng: 73.8520 },
  { lat: 18.5150, lng: 73.8490 },
  { lat: 18.5130, lng: 73.8470 },
  { lat: 18.5110, lng: 73.8455 },
  { lat: 18.5080, lng: 73.8420 },
  { lat: 18.5055, lng: 73.8400 },
  { lat: 18.5030, lng: 73.8385 },
  { lat: 18.5010, lng: 73.8360 },
  { lat: 18.4985, lng: 73.8335 },
  { lat: 18.4965, lng: 73.8318 },
  { lat: 18.4950, lng: 73.8300 },
];

// Map center for initial view
export const MAP_CENTER: RoutePoint = { lat: 18.5080, lng: 73.8430 };
export const MAP_ZOOM = 14;

export const BUS_ID = "BUS-01";
export const ROUTE_NAME = "City Route 1";
