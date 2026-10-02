export type Station = {
  id?: number
  osm_key: string
  name: string
  latitude: number
  longitude: number
  operator?: string | null
  address?: string | null
  access?: string | null
  opening_hours?: string | null
  capacity?: number | null
  connectors: string[]
  charger_type?: string | null
  power_kw?: number | null
  status?: string | null
  city?: string | null
  state?: string | null
  source?: string
  confidence?: string
  category?: string
  recommendation_reasons?: string[]
  source_url: string
  fetched_at?: string
  detour_km?: number
  progress_km?: number
  arrival_soc?: number
  target_soc?: number
  charge_minutes?: number
  energy_kwh?: number
}

export type JourneyResult = {
  journey_id: number
  origin: { name: string; latitude: number; longitude: number }
  destination: { name: string; latitude: number; longitude: number }
  route: { distance_km: number; duration_minutes: number; geometry: { type: string; coordinates: number[][] } }
  stations_considered: number
  nearby_stations: Station[]
  plan: {
    feasible: boolean
    reason?: string | null
    stops: Station[]
    drive_energy_kwh?: number
    charging_minutes?: number
    estimated_cost_inr?: number
  }
  weather?: { temperature_c?: number; precipitation_probability?: number; wind_speed_kmh?: number; visibility_m?: number; condition: string; advisory: string; source: string } | null
  station_sources?: string[]
  data_freshness: string
  attribution: string
}

export type DashboardData = {
  stations_indexed: number
  journeys_planned: number
  data_providers: number
  last_crawl: string | null
  recent_journeys: Array<{ id: number; origin: string; destination: string; distance_km: number; created_at: string }>
}
