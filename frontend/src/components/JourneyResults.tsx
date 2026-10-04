import { useState } from 'react'
import { ArrowRight, BatteryCharging, Check, Clock3, ExternalLink, Gauge, MapPin, MapPinned, Navigation, PlugZap, Route, Search, X } from 'lucide-react'
import RouteMap from './RouteMap'
import { Chip, Empty } from './Ui'
import type { JourneyResult, RouteOption, Station } from '../types'

function duration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return hours ? `${hours} hr ${rest} min` : `${rest} min`
}

function RouteCard({ title, route, primary }: { title: string; route: RouteOption; primary?: boolean }) {
  return (
    <article className={`route-option ${primary ? 'route-option-primary' : ''}`}>
      <div>
        <p className="eyebrow">{title}</p>
        <h3>{route.distance_km} <small>km</small></h3>
        <span>{duration(route.duration_minutes)}</span>
      </div>
      <div className="route-counts">
        <strong>{route.station_count}</strong><span>corridor chargers</span>
        <strong>{route.compatible_station_count}</strong><span>confirmed compatible</span>
      </div>
    </article>
  )
}

function googleMapsUrl(result: JourneyResult) {
  const params = new URLSearchParams({
    api: '1',
    origin: `${result.origin.latitude},${result.origin.longitude}`,
    destination: `${result.destination.latitude},${result.destination.longitude}`,
    travelmode: 'driving',
  })
  const waypoints = result.plan.stops.slice(0, 9).map((stop) => `${stop.latitude},${stop.longitude}`)
  if (waypoints.length) params.set('waypoints', waypoints.join('|'))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

function JourneyItinerary({ result }: { result: JourneyResult }) {
  const stops = [...result.plan.stops].sort((a, b) => (a.progress_km || 0) - (b.progress_km || 0))
  const startSoc = result.trip_settings?.start_soc
  const arrivalSoc = result.trip_settings?.arrival_soc

  return (
    <section className="journey-itinerary glass-card">
      <div className="itinerary-head">
        <div><p className="eyebrow emerald">BATTERY-AWARE DIRECTIONS</p><h2>Your drive plan</h2><p>The route uses your starting charge, vehicle range and connector compatibility to schedule stops.</p></div>
        {result.plan.feasible ? <a className="button primary start-journey" href={googleMapsUrl(result)} target="_blank" rel="noreferrer"><Navigation size={18} /> Start journey <ExternalLink size={16} /></a> : null}
      </div>
      {!result.plan.feasible ? <p className="plan-warning">{result.plan.reason}</p> : null}
      <div className="itinerary-track">
        <div className="itinerary-step"><span className="step-dot">A</span><div><small>Start · {startSoc ?? '—'}% battery</small><strong>{result.origin.name.split(',')[0]}</strong></div></div>
        {stops.map((stop, index) => <div className="itinerary-step itinerary-charge" key={stop.osm_key}><span className="step-dot">{index + 1}</span><div><small>Estimated stop {index + 1} · route km {Math.round(stop.progress_km || 0)}</small><strong>{stop.name}</strong><p>Drive {Math.round(stop.leg_distance_km || 0)} km from the previous point. Estimated arrival {stop.arrival_soc}% · charge to {stop.target_soc}% · about {stop.charge_minutes} min.</p></div></div>)}
        <div className="itinerary-step"><span className="step-dot">B</span><div><small>Destination · keep {arrivalSoc ?? '—'}% reserve</small><strong>{result.destination.name.split(',')[0]}</strong>{!stops.length && result.plan.feasible ? <p>No charging stop is needed at this starting battery level.</p> : null}</div></div>
      </div>
      {result.plan.calculation_note ? <p className="calculation-note">{result.plan.calculation_note}</p> : null}
      {stops.length > 3 ? <p className="navigation-note">Some mobile browsers limit Google Maps links to three waypoints. The full numbered stop plan remains visible on this map.</p> : null}
    </section>
  )
}

function StationCard({ station, evName, stopNumber }: { station: Station; evName: string; stopNumber?: number }) {
  const compatibility = station.compatible === true ? 'Confirmed' : station.compatible === false ? 'Not compatible' : 'Confirm connector'
  const sourceLabel = station.source || station.operator || 'Mapped station'
  return (
    <article className={`station-detail-card ${stopNumber ? 'planned-stop-card' : ''}`}>
      <div className="station-card-head">
        <div>
          <p className="eyebrow emerald">{stopNumber ? `PLANNED STOP ${stopNumber}` : station.opening_hours === '24/7' ? 'OPEN 24/7' : sourceLabel}</p>
          <h3>{station.name}</h3>
          <span>{station.operator || sourceLabel}</span>
        </div>
        <a href={station.source_url} target="_blank" rel="noreferrer" aria-label={`Open source for ${station.name}`}><ArrowRight /></a>
      </div>
      <p className="station-address"><MapPin />{station.address || `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}</p>
      {stopNumber ? <p className="stop-callout"><Navigation />Estimated stop {stopNumber} at route km {Math.round(station.progress_km || 0)}: arrive near {station.arrival_soc}%, then charge to {station.target_soc}% in about {station.charge_minutes} min.</p> : null}
      <div className="station-facts">
        <div><Route /><span><small>Route deviation</small><strong>{station.detour_km ?? '—'} km</strong></span></div>
        <div><Gauge /><span><small>{station.power_kw ? 'Charging power' : 'Connector options'}</small><strong>{station.power_kw ? `${station.power_kw} kW` : `${station.connectors.length || 0} listed`}</strong></span></div>
        <div><Clock3 /><span><small>{stopNumber ? 'Planned charge' : 'Estimated top-up'}</small><strong>{stopNumber ? `${station.charge_minutes} min` : station.estimated_charge_minutes ? `About ${station.estimated_charge_minutes} min` : 'Confirm with operator'}</strong></span></div>
        <div><MapPinned /><span><small>{station.capacity ? 'Charging bays' : station.progress_km ? 'Journey position' : 'Data source'}</small><strong>{station.capacity ? station.capacity : station.progress_km ? `${Math.round(station.progress_km)} km from start` : sourceLabel}</strong></span></div>
      </div>
      <div className="station-connectors"><p><PlugZap /> Connectors</p><div className="chip-row">{station.connectors.length ? station.connectors.map((item) => <Chip key={item}>{item}</Chip>) : <Chip>Confirm with operator</Chip>}{station.effective_charge_kw ? <Chip>{station.effective_charge_kw} kW usable</Chip> : null}</div></div>
      <p className={`compatibility compatibility-${station.compatible === true ? 'yes' : station.compatible === false ? 'no' : 'unknown'}`}><Check />Compatible with {evName}: <strong>{compatibility}</strong></p>
      {station.amenities?.length ? <p className="amenities">Amenities: {station.amenities.join(' • ')}</p> : null}
    </article>
  )
}

export default function JourneyResults({ result }: { result: JourneyResult }) {
  const [stationQuery, setStationQuery] = useState('')
  const [compatibilityFilter, setCompatibilityFilter] = useState('all')
  const [connectorFilter, setConnectorFilter] = useState('all')
  const [speedFilter, setSpeedFilter] = useState('all')
  const evName = `${result.ev.manufacturer} ${result.ev.model}`
  const plannedStops = [...result.plan.stops].sort((a, b) => (a.progress_km || 0) - (b.progress_km || 0))
  const stopIndex = new Map(plannedStops.map((stop, index) => [stop.osm_key, index + 1]))
  const plannedKeys = new Set(plannedStops.map((stop) => stop.osm_key))
  const displayStations = [...plannedStops, ...result.nearby_stations.filter((station) => !plannedKeys.has(station.osm_key))]
  const connectorOptions = [...new Set(displayStations.flatMap((station) => station.connectors))].sort()
  const filteredStations = (() => {
    const query = stationQuery.trim().toLocaleLowerCase()
    return displayStations.filter((station) => {
      const searchable = [station.name, station.address, station.operator, station.city, station.state, station.source].filter(Boolean).join(' ').toLocaleLowerCase()
      if (query && !searchable.includes(query)) return false
      if (compatibilityFilter === 'planned' && !plannedKeys.has(station.osm_key)) return false
      if (compatibilityFilter === 'compatible' && station.compatible !== true) return false
      if (compatibilityFilter === 'confirm' && (station.compatible === true || station.compatible === false)) return false
      if (connectorFilter !== 'all' && !station.connectors.includes(connectorFilter)) return false
      const power = station.power_kw
      if (speedFilter === 'rapid' && (!power || power < 50)) return false
      if (speedFilter === 'fast' && (!power || power < 20 || power >= 50)) return false
      if (speedFilter === 'standard' && (!power || power >= 20)) return false
      if (speedFilter === 'unknown' && power) return false
      return true
    })
  })()
  const filtersActive = Boolean(stationQuery || compatibilityFilter !== 'all' || connectorFilter !== 'all' || speedFilter !== 'all')

  function clearFilters() {
    setStationQuery('')
    setCompatibilityFilter('all')
    setConnectorFilter('all')
    setSpeedFilter('all')
  }

  return (
    <section className="result-stack">
      <header className="journey-heading"><p className="eyebrow emerald">YOUR JOURNEY</p><h2>{result.origin.name.split(',')[0]} <ArrowRight /> {result.destination.name.split(',')[0]}</h2><p>Selected EV: <strong>{result.ev.manufacturer} {result.ev.model} {result.ev.variant}</strong></p></header>
      <div className="route-options"><RouteCard title="CHARGING-FRIENDLY ROUTE" route={result.routes.charging_friendly} primary /><RouteCard title="DEFAULT ROUTE" route={result.routes.default} /></div>
      {result.routes.message ? <p className="route-message">{result.routes.message}</p> : null}
      <RouteMap stations={result.nearby_stations} route={result.routes.charging_friendly.geometry.coordinates} defaultRoute={result.routes.default.geometry.coordinates} stops={plannedStops} className="large-map" />
      <div className="result-summary">
        <div><BatteryCharging /><span><small>Corridor chargers</small><strong>{result.stations_considered}</strong></span></div>
        <div><MapPinned /><span><small>Planned charging stops</small><strong>{plannedStops.length}</strong></span></div>
        <div><Clock3 /><span><small>Planned charging time</small><strong>{result.plan.charging_minutes || 0} min</strong></span></div>
      </div>
      <JourneyItinerary result={result} />
      <section className="stations-section">
        <div className="section-head"><div><p className="eyebrow emerald">ALONG YOUR ROUTE</p><h2>Charging stations</h2><p className="section-support">Numbered green cards are stops added to your driving directions.</p></div><span className="source-note">{result.station_sources?.join(' + ') || 'Station source unavailable'}{result.stations_considered > result.nearby_stations.length ? ` · Showing ${result.nearby_stations.length} of ${result.stations_considered}` : ''}</span></div>
        {displayStations.length ? <>
          <div className="station-tools" aria-label="Charging station filters">
            <label className="station-search"><span>Search stations</span><div className="input-icon"><Search /><input type="search" value={stationQuery} onChange={(event) => setStationQuery(event.target.value)} placeholder="Name, operator, city or address" /></div></label>
            <label><span>Compatibility</span><select value={compatibilityFilter} onChange={(event) => setCompatibilityFilter(event.target.value)}><option value="all">All stations</option><option value="planned">Planned stops</option><option value="compatible">Confirmed compatible</option><option value="confirm">Connector to confirm</option></select></label>
            <label><span>Connector</span><select value={connectorFilter} onChange={(event) => setConnectorFilter(event.target.value)}><option value="all">All connectors</option>{connectorOptions.map((connector) => <option key={connector} value={connector}>{connector}</option>)}</select></label>
            <label><span>Charging speed</span><select value={speedFilter} onChange={(event) => setSpeedFilter(event.target.value)}><option value="all">Any speed</option><option value="rapid">Rapid · 50+ kW</option><option value="fast">Fast · 20–49 kW</option><option value="standard">Standard · under 20 kW</option><option value="unknown">Power not listed</option></select></label>
            {filtersActive ? <button type="button" className="clear-filters" onClick={clearFilters}><X /> Clear</button> : null}
          </div>
          <p className="filter-result-count">Showing {filteredStations.length} of {displayStations.length} stations</p>
          {filteredStations.length ? <div className="station-detail-grid">{filteredStations.map((station) => <StationCard key={station.osm_key} station={station} evName={evName} stopNumber={stopIndex.get(station.osm_key)} />)}</div> : <Empty>No charging stations match these filters. Clear one or more filters to see the full corridor list.</Empty>}
        </> : <Empty>No charging stations were returned for this corridor. The default route is still available above.</Empty>}
      </section>
      <p className="attribution">{result.attribution}</p>
    </section>
  )
}
