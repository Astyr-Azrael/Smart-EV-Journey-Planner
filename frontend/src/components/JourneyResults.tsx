import { ArrowRight, BatteryCharging, Check, Clock3, IndianRupee, MapPin, PlugZap, Route, Star } from 'lucide-react'
import RouteMap from './RouteMap'
import { Chip, Empty } from './Ui'
import type { JourneyResult, RouteOption, Station } from '../types'

function duration(minutes: number) { const hours = Math.floor(minutes / 60); const rest = Math.round(minutes % 60); return hours ? `${hours} hr ${rest} min` : `${rest} min` }

function RouteCard({ title, route, primary }: { title: string; route: RouteOption; primary?: boolean }) {
  return <article className={`route-option ${primary ? 'route-option-primary' : ''}`}><div><p className="eyebrow">{title}</p><h3>{route.distance_km} km</h3><span>{duration(route.duration_minutes)}</span></div><div className="route-counts"><strong>{route.station_count}</strong><span>charging stations</span><strong>{route.compatible_station_count}</strong><span>confirmed compatible</span></div></article>
}

function ratingLabel(value?: number | null) { if (!value || value <= 2) return null; return value >= 4 ? 'GOOD' : 'AVERAGE' }

function StationCard({ station, evName }: { station: Station; evName: string }) {
  const label = ratingLabel(station.rating)
  const compatibility = station.compatible === true ? 'YES' : station.compatible === false ? 'NO' : 'NOT AVAILABLE'
  return (
    <article className="station-detail-card">
      <div className="station-card-head">
        <div><p className="eyebrow emerald">{station.opening_status || 'Opening status unavailable'}</p><h3>{station.name}</h3><span>{station.operator || 'Operator not listed'}</span></div>
        <a href={station.source_url} target="_blank" rel="noreferrer" aria-label={`Open source for ${station.name}`}><ArrowRight /></a>
      </div>
      <p className="station-address"><MapPin />{station.address || `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}</p>
      <div className="station-facts">
        <div><Route /><span><small>Route deviation</small><strong>{station.detour_km ?? '—'} km</strong></span></div>
        <div><IndianRupee /><span><small>Charging price</small><strong>{station.tariff || 'Unavailable'}</strong>{station.estimated_cost_inr !== null && station.estimated_cost_inr !== undefined ? <em>Estimated 40% top-up: ₹{station.estimated_cost_inr}</em> : null}</span></div>
        <div><Star /><span><small>Rating</small><strong>{station.rating ? `${station.rating} / 5${label ? ` • ${label}` : ''}` : 'Unavailable'}</strong>{station.rating_count ? <em>{station.rating_count} ratings</em> : null}</span></div>
        <div><Clock3 /><span><small>Estimated charging time</small><strong>{station.estimated_charge_minutes ? `About ${station.estimated_charge_minutes} min` : 'Unavailable'}</strong></span></div>
      </div>
      <div className="station-connectors"><p><PlugZap /> Connectors</p><div className="chip-row">{station.connectors.length ? station.connectors.map((item) => <Chip key={item}>{item}</Chip>) : <Chip>Not listed</Chip>}{station.power_kw ? <Chip>{station.power_kw} kW</Chip> : null}</div></div>
      <p className={`compatibility compatibility-${station.compatible === true ? 'yes' : station.compatible === false ? 'no' : 'unknown'}`}><Check />Compatible with {evName}: <strong>{compatibility}</strong></p>
      {station.amenities?.length ? <p className="amenities">Amenities: {station.amenities.join(' • ')}</p> : null}
    </article>
  )
}

export default function JourneyResults({ result }: { result: JourneyResult }) {
  const evName = `${result.ev.manufacturer} ${result.ev.model}`
  return <section className="result-stack"><header className="journey-heading"><p className="eyebrow emerald">YOUR JOURNEY</p><h2>{result.origin.name.split(',')[0]} <ArrowRight /> {result.destination.name.split(',')[0]}</h2><p>Selected EV: <strong>{result.ev.manufacturer} {result.ev.model} {result.ev.variant}</strong></p></header><div className="route-options"><RouteCard title="CHARGING-FRIENDLY ROUTE" route={result.routes.charging_friendly} primary /><RouteCard title="DEFAULT ROUTE" route={result.routes.default} /></div>{result.routes.message ? <p className="route-message">{result.routes.message}</p> : null}<RouteMap stations={result.nearby_stations} route={result.routes.charging_friendly.geometry.coordinates} defaultRoute={result.routes.default.geometry.coordinates} stops={result.plan.stops} className="large-map" /><div className="result-summary"><div><BatteryCharging /><span><small>Charging stations found</small><strong>{result.stations_considered}</strong></span></div><div><PlugZap /><span><small>Confirmed compatible</small><strong>{result.routes.charging_friendly.compatible_station_count}</strong></span></div><div><Clock3 /><span><small>Planned charging time</small><strong>{result.plan.charging_minutes || 0} min</strong></span></div></div><section><div className="section-head"><div><p className="eyebrow emerald">ALONG YOUR ROUTE</p><h2>Charging stations</h2></div><span className="source-note">{result.station_sources?.join(' + ') || 'Station source unavailable'}{result.stations_considered > result.nearby_stations.length ? ` · Showing ${result.nearby_stations.length} of ${result.stations_considered}` : ''}</span></div>{result.nearby_stations.length ? <div className="station-detail-grid">{result.nearby_stations.map((station) => <StationCard key={station.osm_key} station={station} evName={evName} />)}</div> : <Empty>No charging stations were returned for this corridor. The default route is still available above.</Empty>}</section><p className="attribution">{result.attribution}</p></section>
}
