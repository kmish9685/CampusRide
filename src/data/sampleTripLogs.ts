export interface TripLogRow {
  id?: string | number;
  bus_id: string;
  stop_name: string;
  scheduled_time: string;
  actual_time: string;
  boarded_count: number;
}

// 60 realistic sample trip logs matching the SQL seed
export const SAMPLE_TRIP_LOGS: TripLogRow[] = [
  // Morning Peak (07:30 - 09:30)
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-27T07:30:00Z", actual_time: "2026-09-27T07:32:00Z", boarded_count: 24 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-27T07:45:00Z", actual_time: "2026-09-27T07:49:00Z", boarded_count: 32 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-27T08:00:00Z", actual_time: "2026-09-27T08:08:00Z", boarded_count: 28 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-27T08:15:00Z", actual_time: "2026-09-27T08:25:00Z", boarded_count: 18 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-27T08:30:00Z", actual_time: "2026-09-27T08:42:00Z", boarded_count: 5 },

  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-28T07:30:00Z", actual_time: "2026-09-28T07:31:00Z", boarded_count: 26 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-28T07:45:00Z", actual_time: "2026-09-28T07:52:00Z", boarded_count: 35 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-28T08:00:00Z", actual_time: "2026-09-28T08:09:00Z", boarded_count: 31 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-28T08:15:00Z", actual_time: "2026-09-28T08:26:00Z", boarded_count: 20 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-28T08:30:00Z", actual_time: "2026-09-28T08:44:00Z", boarded_count: 4 },

  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-29T07:30:00Z", actual_time: "2026-09-29T07:33:00Z", boarded_count: 22 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-29T07:45:00Z", actual_time: "2026-09-29T07:50:00Z", boarded_count: 38 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-29T08:00:00Z", actual_time: "2026-09-29T08:11:00Z", boarded_count: 29 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-29T08:15:00Z", actual_time: "2026-09-29T08:24:00Z", boarded_count: 17 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-29T08:30:00Z", actual_time: "2026-09-29T08:40:00Z", boarded_count: 6 },

  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-30T07:30:00Z", actual_time: "2026-09-30T07:29:00Z", boarded_count: 25 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-30T07:45:00Z", actual_time: "2026-09-30T07:53:00Z", boarded_count: 36 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-30T08:00:00Z", actual_time: "2026-09-30T08:10:00Z", boarded_count: 33 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-30T08:15:00Z", actual_time: "2026-09-30T08:27:00Z", boarded_count: 19 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-30T08:30:00Z", actual_time: "2026-09-30T08:43:00Z", boarded_count: 5 },

  // Midday Trips (10:00 - 12:30)
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-27T10:00:00Z", actual_time: "2026-09-27T10:02:00Z", boarded_count: 12 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-27T10:15:00Z", actual_time: "2026-09-27T10:18:00Z", boarded_count: 16 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-27T10:30:00Z", actual_time: "2026-09-27T10:34:00Z", boarded_count: 14 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-27T10:45:00Z", actual_time: "2026-09-27T10:48:00Z", boarded_count: 9 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-27T11:00:00Z", actual_time: "2026-09-27T11:04:00Z", boarded_count: 2 },

  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-28T10:00:00Z", actual_time: "2026-09-28T10:01:00Z", boarded_count: 14 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-28T10:15:00Z", actual_time: "2026-09-28T10:17:00Z", boarded_count: 19 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-28T10:30:00Z", actual_time: "2026-09-28T10:33:00Z", boarded_count: 12 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-28T10:45:00Z", actual_time: "2026-09-28T10:47:00Z", boarded_count: 8 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-28T11:00:00Z", actual_time: "2026-09-28T11:03:00Z", boarded_count: 3 },

  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-29T10:00:00Z", actual_time: "2026-09-29T10:02:00Z", boarded_count: 11 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-29T10:15:00Z", actual_time: "2026-09-29T10:19:00Z", boarded_count: 17 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-29T10:30:00Z", actual_time: "2026-09-29T10:35:00Z", boarded_count: 15 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-29T10:45:00Z", actual_time: "2026-09-29T10:49:00Z", boarded_count: 10 },
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-29T11:00:00Z", actual_time: "2026-09-29T11:05:00Z", boarded_count: 2 },

  // Afternoon & Evening Peak (16:00 - 17:30)
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-27T16:00:00Z", actual_time: "2026-09-27T16:04:00Z", boarded_count: 34 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-27T16:15:00Z", actual_time: "2026-09-27T16:22:00Z", boarded_count: 21 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-27T16:30:00Z", actual_time: "2026-09-27T16:38:00Z", boarded_count: 19 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-27T16:45:00Z", actual_time: "2026-09-27T16:56:00Z", boarded_count: 15 },
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-27T17:00:00Z", actual_time: "2026-09-27T17:14:00Z", boarded_count: 8 },

  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-28T16:00:00Z", actual_time: "2026-09-28T16:05:00Z", boarded_count: 38 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-28T16:15:00Z", actual_time: "2026-09-28T16:24:00Z", boarded_count: 25 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-28T16:30:00Z", actual_time: "2026-09-28T16:41:00Z", boarded_count: 22 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-28T16:45:00Z", actual_time: "2026-09-28T16:59:00Z", boarded_count: 18 },
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-28T17:00:00Z", actual_time: "2026-09-28T17:18:00Z", boarded_count: 7 },

  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-29T16:00:00Z", actual_time: "2026-09-29T16:03:00Z", boarded_count: 36 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-29T16:15:00Z", actual_time: "2026-09-29T16:21:00Z", boarded_count: 23 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-29T16:30:00Z", actual_time: "2026-09-29T16:39:00Z", boarded_count: 20 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-29T16:45:00Z", actual_time: "2026-09-29T16:55:00Z", boarded_count: 16 },
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-29T17:00:00Z", actual_time: "2026-09-29T17:15:00Z", boarded_count: 9 },

  // Late Evening (18:00 - 19:30)
  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-28T18:00:00Z", actual_time: "2026-09-28T18:02:00Z", boarded_count: 15 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-28T18:15:00Z", actual_time: "2026-09-28T18:18:00Z", boarded_count: 11 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-28T18:30:00Z", actual_time: "2026-09-28T18:34:00Z", boarded_count: 9 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-28T18:45:00Z", actual_time: "2026-09-28T18:50:00Z", boarded_count: 7 },
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-28T19:00:00Z", actual_time: "2026-09-28T19:06:00Z", boarded_count: 3 },

  { bus_id: "BUS-01", stop_name: "College Main Gate", scheduled_time: "2026-09-29T18:00:00Z", actual_time: "2026-09-29T18:03:00Z", boarded_count: 18 },
  { bus_id: "BUS-01", stop_name: "Science Park Junction", scheduled_time: "2026-09-29T18:15:00Z", actual_time: "2026-09-29T18:20:00Z", boarded_count: 13 },
  { bus_id: "BUS-01", stop_name: "Residential Colony", scheduled_time: "2026-09-29T18:30:00Z", actual_time: "2026-09-29T18:36:00Z", boarded_count: 10 },
  { bus_id: "BUS-01", stop_name: "Market Square", scheduled_time: "2026-09-29T18:45:00Z", actual_time: "2026-09-29T18:51:00Z", boarded_count: 8 },
  { bus_id: "BUS-01", stop_name: "City Bus Stand", scheduled_time: "2026-09-29T19:00:00Z", actual_time: "2026-09-29T19:07:00Z", boarded_count: 4 },
];

/**
 * Computes metrics and chart datasets from any array of trip logs.
 */
export function computeTripLogMetrics(logs: TripLogRow[]) {
  if (!logs || logs.length === 0) {
    logs = SAMPLE_TRIP_LOGS;
  }

  // 1. Delays per stop
  const stopDelayMap: Record<string, { totalDelayMin: number; count: number; totalBoardings: number }> = {};
  // 2. Hourly boardings map
  const hourlyMap: Record<string, number> = {};

  let totalDelayMin = 0;
  let totalTrips = 0;

  for (const log of logs) {
    const sched = new Date(log.scheduled_time).getTime();
    const act = new Date(log.actual_time).getTime();
    const delayMin = Math.max(0, (act - sched) / (1000 * 60));

    totalDelayMin += delayMin;
    totalTrips += 1;

    // By Stop
    if (!stopDelayMap[log.stop_name]) {
      stopDelayMap[log.stop_name] = { totalDelayMin: 0, count: 0, totalBoardings: 0 };
    }
    stopDelayMap[log.stop_name].totalDelayMin += delayMin;
    stopDelayMap[log.stop_name].count += 1;
    stopDelayMap[log.stop_name].totalBoardings += log.boarded_count;

    // By Hour
    const hourNum = new Date(log.scheduled_time).getUTCHours();
    const hourLabel = `${hourNum.toString().padStart(2, "0")}:00`;
    hourlyMap[hourLabel] = (hourlyMap[hourLabel] || 0) + log.boarded_count;
  }

  const avgDelayAll = totalTrips > 0 ? (totalDelayMin / totalTrips).toFixed(1) : "0";

  // Format Bar Chart: Average delay per stop
  const delayChartData = Object.entries(stopDelayMap).map(([stop, val]) => ({
    stop: stop.replace(" Junction", "").replace(" Colony", ""),
    fullName: stop,
    delay: Number((val.totalDelayMin / val.count).toFixed(1)),
  }));

  // Format Bar Chart: Students boarding per stop
  const boardingChartData = Object.entries(stopDelayMap).map(([stop, val]) => ({
    stop: stop.replace(" Junction", "").replace(" Colony", ""),
    fullName: stop,
    boardings: val.totalBoardings,
  }));

  // Format Line Chart: Boardings by hour of day
  const hourlyChartData = Object.entries(hourlyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, boardings]) => ({
      hour,
      boardings,
    }));

  // Identify busiest stop
  let busiestStopName = "Market Square";
  let maxBoardings = 0;
  for (const [stop, val] of Object.entries(stopDelayMap)) {
    if (val.totalBoardings > maxBoardings) {
      maxBoardings = val.totalBoardings;
      busiestStopName = stop;
    }
  }

  // Identify peak hour
  let peakHour = "08:00 - 09:00";
  let maxHourly = 0;
  for (const [hour, count] of Object.entries(hourlyMap)) {
    if (count > maxHourly) {
      maxHourly = count;
      peakHour = `${hour} Peak`;
    }
  }

  // Identify stop with highest delay
  let highestDelayStop = "College Main Gate";
  let maxStopDelay = 0;
  for (const [stop, val] of Object.entries(stopDelayMap)) {
    const avg = val.totalDelayMin / val.count;
    if (avg > maxStopDelay) {
      maxStopDelay = avg;
      highestDelayStop = stop;
    }
  }

  return {
    avgDelayAll,
    busiestStopName,
    peakHour,
    highestDelayStop,
    maxStopDelay: maxStopDelay.toFixed(1),
    delayChartData,
    boardingChartData,
    hourlyChartData,
  };
}
