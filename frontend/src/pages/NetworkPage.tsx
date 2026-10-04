import { BatteryCharging, Database, MapPinned, Search, X } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { api } from '../api'
import { StationCard } from '../components/JourneyResults'
import PlaceField from '../components/PlaceField'
import RouteMap from '../components/RouteMap'
import { Empty, ErrorNotice, Loading } from '../components/Ui'
import type { Station } from '../types'

type SelectedPlace = { latitude: number; longitude: number }
type NetworkResult = {
  place: { name: string; latitude: number; longitude: number }
  stations: Station[]
  station_sources?: string[]
  warning?: string | null
}

export default function NetworkPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [place, setPlace] = useState('Mumbai')
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null)
  const [resultPlace, setResultPlace] = useState('')
  const [sources, setSources] = useState<string[]>([])
  const [liveWarning, setLiveWarning] = useState(false)
  const [radius, setRadius] = useState(10)
  const [query, setQuery] = useState('')
  const [connectorFilter, setConnectorFilter] = useState('all')
  const [speedFilter, setSpeedFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function changePlace(value: string, selected?: SelectedPlace) {
    setPlace(value)
    setSelectedPlace(selected || null)
  }

  async function findStations(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setStations([])
    setLiveWarning(false)
    try {
      const result = await api<NetworkResult>('/api/crawl/stations', {
        method: 'POST',
        body: JSON.stringify({ place, radius_km: radius, latitude: selectedPlace?.latitude, longitude: selectedPlace?.longitude }),
      })
      setStations(result.stations)
      setSources(result.station_sources || [])
      setResultPlace(result.place.name || place)
      setLiveWarning(Boolean(result.warning))
      setQuery('')
      setConnectorFilter('all')
      setSpeedFilter('all')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not find charging stations')
    } finally {
      setLoading(false)
    }
  }

  const connectorOptions = useMemo(() => [...new Set(stations.flatMap((station) => station.connectors))].sort(), [stations])
  const filtered = useMemo(() => stations.filter((station) => {
    const term = query.trim().toLocaleLowerCase()
    const searchable = [station.name, station.operator, station.address, station.city, station.state, station.source].filter(Boolean).join(' ').toLocaleLowerCase()
    if (term && !searchable.includes(term)) return false
    if (connectorFilter !== 'all' && !station.connectors.includes(connectorFilter)) return false
    const power = station.power_kw
    if (speedFilter === 'rapid' && (!power || power < 50)) return false
    if (speedFilter === 'fast' && (!power || power < 20 || power >= 50)) return false
    if (speedFilter === 'standard' && (!power || power >= 20)) return false
    if (speedFilter === 'unknown' && power) return false
    return true
  }), [connectorFilter, query, speedFilter, stations])
  const filtersActive = Boolean(query || connectorFilter !== 'all' || speedFilter !== 'all')

  function clearFilters() {
    setQuery('')
    setConnectorFilter('all')
    setSpeedFilter('all')
  }

  return <div className="stack-lg">
    <section className="planner-layout network-planner">
      <form onSubmit={findStations} className="glass-card planner-form">
        <div className="section-head"><div><p className="eyebrow emerald">NEAREST CHARGING STATION</p><h2>Find chargers around you.</h2></div><MapPinned /></div>
        <PlaceField id="network-place" label="City or place" value={place} onChange={changePlace} />
        <label>Search radius<select value={radius} onChange={(event) => setRadius(+event.target.value)}><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option></select></label>
        <button className="button primary wide" disabled={loading}><Search />{loading ? 'Searching live station sources…' : 'Find charging stations'}</button>
        <p className="form-note">Uses the same nationwide BEE EV Yatra dataset and live OpenStreetMap enrichment as the journey planner.</p>
      </form>
      <aside className="planner-side pale-panel network-side">
        <p className="eyebrow emerald">NATIONWIDE NETWORK</p>
        <h3>Real stations.<br /><em>Near any Indian place.</em></h3>
        <div className="spec-list"><div><Database /><span><small>Station data</small><strong>BEE EV Yatra + OpenStreetMap</strong></span></div><div><MapPinned /><span><small>Location matching</small><strong>Exact selected coordinates</strong></span></div><div><Search /><span><small>Results</small><strong>Sorted nearest first</strong></span></div></div>
      </aside>
    </section>
    {loading && <Loading label={`Finding charging stations around ${place}…`} />}
    {error && <ErrorNotice message={error} />}
    {liveWarning && stations.length ? <p className="route-message">Live OpenStreetMap enrichment was temporarily unavailable, so verified nationwide BEE station data is shown.</p> : null}
    {stations.length ? <>
      <RouteMap stations={filtered} className="network-map" />
      <section className="stations-section">
        <div className="section-head"><div><p className="eyebrow emerald">NEARBY NETWORK</p><h2>{stations.length} stations near {resultPlace.split(',')[0]}</h2><p className="section-support">Results are ordered by straight-line distance from your selected place.</p></div><span className="source-note">{sources.join(' + ') || 'Station source unavailable'}</span></div>
        <div className="station-tools network-station-tools" aria-label="Charging station filters">
          <label className="station-search"><span>Search stations</span><div className="input-icon"><Search /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, operator, city or address" /></div></label>
          <label><span>Connector</span><select value={connectorFilter} onChange={(event) => setConnectorFilter(event.target.value)}><option value="all">All connectors</option>{connectorOptions.map((connector) => <option key={connector} value={connector}>{connector}</option>)}</select></label>
          <label><span>Charging speed</span><select value={speedFilter} onChange={(event) => setSpeedFilter(event.target.value)}><option value="all">Any speed</option><option value="rapid">Rapid · 50+ kW</option><option value="fast">Fast · 20–49 kW</option><option value="standard">Standard · under 20 kW</option><option value="unknown">Power not listed</option></select></label>
          {filtersActive ? <button type="button" className="clear-filters" onClick={clearFilters}><X /> Clear</button> : null}
        </div>
        <p className="filter-result-count">Showing {filtered.length} of {stations.length} stations</p>
        {filtered.length ? <div className="station-detail-grid">{filtered.map((station) => <StationCard station={station} key={station.osm_key} />)}</div> : <Empty>No charging stations match these filters. Clear one or more filters to see all nearby stations.</Empty>}
      </section>
    </> : !loading && !error ? <Empty><BatteryCharging /> Select any Indian city or place to find its nearest mapped charging stations.</Empty> : null}
  </div>
}
