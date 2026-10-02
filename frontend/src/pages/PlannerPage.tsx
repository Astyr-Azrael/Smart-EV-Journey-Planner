import { ArrowRight, Battery, CheckCircle2, CloudRain, Clock3, IndianRupee, MapPin, Navigation, PlugZap, Route as RouteIcon, Thermometer, Wind, Zap } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { api } from '../api'
import RouteMap from '../components/RouteMap'
import { Chip, ErrorNotice, Loading } from '../components/Ui'
import type { JourneyResult } from '../types'

const defaults = { origin: 'Mumbai', destination: 'Pune', vehicle: 'Custom EV', usable_range_km: 300, start_soc: 40, arrival_soc: 15, consumption_kwh_100km: 17, battery_kwh: 60, connector: 'CCS2', preferred_charger_type: 'DC' }

export default function PlannerPage() {
  const [form, setForm] = useState(defaults)
  const [result, setResult] = useState<JourneyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (key: string, value: string | number) => setForm((state) => ({ ...state, [key]: value }))
  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setResult(null)
    try { setResult(await api<JourneyResult>('/api/journeys/plan', { method: 'POST', body: JSON.stringify({ ...form, connector: form.connector || null }) })) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not plan the journey') }
    finally { setLoading(false) }
  }
  return (
    <div className="stack-lg">
      <section className="planner-layout">
        <form className="glass-card planner-form" onSubmit={submit}>
          <div className="section-head"><div><p className="eyebrow emerald">ROUTE INPUT</p><h2>Where to next?</h2></div><Navigation /></div>
          <label>Starting point<div className="input-icon"><MapPin /><input value={form.origin} onChange={(e) => set('origin', e.target.value)} required /></div></label>
          <label>Destination<div className="input-icon"><MapPin /><input value={form.destination} onChange={(e) => set('destination', e.target.value)} required /></div></label>
          <div className="form-grid">
            <label>Usable range (km)<input type="number" min="60" max="1000" value={form.usable_range_km} onChange={(e) => set('usable_range_km', +e.target.value)} /></label>
            <label>Battery (kWh)<input type="number" min="10" max="250" value={form.battery_kwh} onChange={(e) => set('battery_kwh', +e.target.value)} /></label>
            <label>Start charge (%)<input type="number" min="10" max="100" value={form.start_soc} onChange={(e) => set('start_soc', +e.target.value)} /></label>
            <label>Arrival reserve (%)<input type="number" min="5" max="60" value={form.arrival_soc} onChange={(e) => set('arrival_soc', +e.target.value)} /></label>
            <label>Consumption (kWh/100 km)<input type="number" min="6" max="60" step="0.5" value={form.consumption_kwh_100km} onChange={(e) => set('consumption_kwh_100km', +e.target.value)} /></label>
            <label>Connector<select value={form.connector} onChange={(e) => set('connector', e.target.value)}><option value="">Any connector</option><option>CCS2</option><option>Type 2</option><option>CHAdeMO</option><option>Tesla Supercharger</option></select></label>
            <label>Preferred charger<select value={form.preferred_charger_type} onChange={(e) => set('preferred_charger_type', e.target.value)}><option value="">Any type</option><option value="DC">DC fast</option><option value="AC">AC</option></select></label>
          </div>
          <button className="button primary wide" disabled={loading}>{loading ? 'Calculating…' : <>Build smart route <ArrowRight size={18} /></>}</button>
          <p className="form-note">Live request to Nominatim, OSRM and Overpass. First results may take a few seconds.</p>
        </form>
        <div className="planner-side pale-panel">
          <p className="eyebrow emerald">BEFORE YOU GO</p><h3>Range anxiety,<br /><em>recalculated.</em></h3>
          <div className="energy-gauge"><span style={{ width: `${form.start_soc}%` }} /><strong>{form.start_soc}%</strong></div>
          <div className="mini-detail"><Battery /><span><small>Estimated starting reach</small><strong>{Math.round(form.usable_range_km * form.start_soc / 100)} km</strong></span></div>
          <div className="mini-detail"><PlugZap /><span><small>Required arrival buffer</small><strong>{form.arrival_soc}%</strong></span></div>
        </div>
      </section>
      {loading && <Loading label="Geocoding, routing and crawling chargers along the corridor…" />}
      {error && <ErrorNotice message={error} />}
      {result && <section className="result-stack">
        <div className={`route-status ${result.plan.feasible ? 'success' : 'warning'}`}><CheckCircle2 /><div><strong>{result.plan.feasible ? 'Journey is charge-ready' : 'Route needs attention'}</strong><p>{result.plan.feasible ? `${result.plan.stops.length} planned charging stop${result.plan.stops.length === 1 ? '' : 's'} across ${result.route.distance_km} km.` : result.plan.reason}</p></div></div>
        <div className="route-metrics">
          <div><RouteIcon /><strong>{result.route.distance_km} km</strong><span>road distance</span></div>
          <div><Clock3 /><strong>{Math.floor(result.route.duration_minutes / 60)}h {result.route.duration_minutes % 60}m</strong><span>drive time</span></div>
          <div><Zap /><strong>{result.plan.drive_energy_kwh ?? '—'} kWh</strong><span>estimated energy</span></div>
          <div><IndianRupee /><strong>₹{result.plan.estimated_cost_inr ?? '—'}</strong><span>estimated charge</span></div>
        </div>
        {result.weather && <div className="weather-strip"><div><p className="eyebrow emerald">ROUTE WEATHER • {result.weather.source}</p><strong>{result.weather.advisory}</strong></div><span><Thermometer />{result.weather.temperature_c ?? '—'}°C</span><span><CloudRain />{result.weather.precipitation_probability ?? '—'}% rain</span><span><Wind />{result.weather.wind_speed_kmh ?? '—'} km/h</span></div>}
        <RouteMap stations={result.nearby_stations} route={result.route.geometry.coordinates} stops={result.plan.stops} className="large-map" />
        <div className="two-col result-columns">
          <article className="glass-card"><div className="section-head"><div><p className="eyebrow emerald">SMART ITINERARY</p><h3>Charging stops</h3></div><Chip dark>{result.stations_considered} scanned</Chip></div>
            {result.plan.stops.length ? <div className="stop-list">{result.plan.stops.map((stop, index) => <div className="stop-row" key={stop.osm_key}><span className="stop-number">{index + 1}</span><div><strong>{stop.name}</strong><p>{Math.round(stop.progress_km || 0)} km into journey · {stop.detour_km} km off route</p><div className="chip-row"><Chip>{stop.arrival_soc}% → {stop.target_soc}%</Chip><Chip>{stop.charge_minutes} min</Chip>{stop.power_kw && <Chip>{stop.power_kw} kW</Chip>}{stop.connectors.slice(0, 2).map((connector) => <Chip key={connector}>{connector}</Chip>)}</div>{stop.recommendation_reasons && <ul className="reason-list">{stop.recommendation_reasons.map((reason) => <li key={reason}><CheckCircle2 />{reason}</li>)}</ul>}</div><a href={stop.source_url} target="_blank" rel="noreferrer" className="source-arrow"><ArrowRight /></a></div>)}</div> : <p className="soft-copy">No charging stop is required for this route at the entered range and charge.</p>}
          </article>
          <article className="glass-card route-summary"><p className="eyebrow">ROUTE SUMMARY</p><h3>{result.origin.name.split(',')[0]} <ArrowRight /> {result.destination.name.split(',')[0]}</h3><div className="summary-line"><span>Charging time</span><strong>{result.plan.charging_minutes || 0} min</strong></div><div className="summary-line"><span>Live stations checked</span><strong>{result.stations_considered}</strong></div><div className="summary-line"><span>Station sources</span><strong>{result.station_sources?.join(' + ') || 'OSM'}</strong></div><div className="summary-line"><span>Data fetched</span><strong>{new Date(result.data_freshness).toLocaleTimeString()}</strong></div><p className="attribution">{result.attribution}</p></article>
        </div>
      </section>}
    </div>
  )
}
