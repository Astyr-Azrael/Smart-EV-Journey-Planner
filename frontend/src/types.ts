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
  effective_charge_kw?: number
  leg_distance_km?: number
  compatible?: boolean | null
  opening_status?: string
  tariff?: string | null
  estimated_cost_inr?: number | null
  rating?: number | null
  rating_count?: number | null
  amenities?: string[]
  estimated_charge_minutes?: number | null
}
export type EVSpec = {
  ev_id: string
  manufacturer: string
  model: string
  variant: string
  battery_kwh: number
  certified_range_km: number
  ac_connector: string
  dc_connector: string
  max_ac_kw?: number | null
  max_dc_kw?: number | null
  source_url: string
  last_updated: string
}

export type RouteOption = {
  distance_km: number
  duration_minutes: number
  geometry: { type: string; coordinates: number[][] }
  station_count: number
  compatible_station_count: number
  unknown_compatibility_count: number
}

export type JourneyResult = {
  journey_id: number
  origin: { name: string; latitude: number; longitude: number }
  destination: { name: string; latitude: number; longitude: number }
  route: { distance_km: number; duration_minutes: number; geometry: { type: string; coordinates: number[][] } }
  routes: { default: RouteOption; charging_friendly: RouteOption; alternative_found: boolean; message?: string | null }
  ev: EVSpec
  stations_considered: number
  nearby_stations: Station[]
  plan: {
    feasible: boolean
    reason?: string | null
    stops: Station[]
    drive_energy_kwh?: number
    charging_minutes?: number
    estimated_cost_inr?: number
    calculation_note?: string
  }
  trip_settings?: {
    start_soc: number
    arrival_soc: number
    usable_range_km: number
    consumption_kwh_100km: number
  }
  station_sources?: string[]
  data_freshness: string
  attribution: string
}
