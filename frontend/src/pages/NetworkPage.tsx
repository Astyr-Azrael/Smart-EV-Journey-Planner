import { ArrowUpRight, BatteryCharging, MapPin, Radar } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import RouteMap from '../components/RouteMap'
import { Chip, Empty, ErrorNotice, Loading } from '../components/Ui'
import type { Station } from '../types'

export default function NetworkPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [place, setPlace] = useState('Bengaluru')
  const [radius, setRadius] = useState(25)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { api<Station[]>('/api/stations').then(setStations).catch(() => {}) }, [])
  async function crawl(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('')
    try { const result = await api<{ stations: Station[]; records_found: number }>('/api/crawl/stations', { method: 'POST', body: JSON.stringify({ place, radius_km: radius }) }); setStations(result.stations) }
    catch (err) { setError(err instanceof Error ? err.message : 'Crawl failed') }
    finally { setLoading(false) }
  }
  const filtered = useMemo(() => stations.filter((station) => `${station.name} ${station.operator || ''}`.toLowerCase().includes(query.toLowerCase())), [stations, query])
  return (
    <div className="stack-lg">
      <section className="crawl-banner emerald-panel">
        <div><p className="eyebrow">LIVE OVERPASS CRAWLER</p><h2>Map the chargers<br />around any city.</h2><p>No fixture files. Each scan queries OpenStreetMap now, normalizes the records, and saves source links.</p></div>
        <form onSubmit={crawl} className="crawl-form"><label>City or place<input value={place} onChange={(e) => setPlace(e.target.value)} required /></label><label>Radius<select value={radius} onChange={(e) => setRadius(+e.target.value)}><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option><option value="100">100 km</option></select></label><button className="button dark" disabled={loading}><Radar /> {loading ? 'Crawling…' : 'Start live crawl'}</button></form>
      </section>
      {loading && <Loading label={`Crawling charger records around ${place}…`} />}{error && <ErrorNotice message={error} />}
      <RouteMap stations={filtered} className="network-map" />
      <section className="glass-card"><div className="section-head"><div><p className="eyebrow emerald">DISCOVERED NETWORK</p><h3>{stations.length} live stations</h3></div><input className="search-box" placeholder="Filter by name or operator" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        {filtered.length ? <div className="station-grid">{filtered.map((station) => <article className="station-card" key={station.osm_key}><div className="station-title"><span><BatteryCharging /></span><div><h4>{station.name}</h4><p>{station.operator || 'Independent / not listed'}</p></div></div><p className="station-address"><MapPin />{station.address || `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}</p><div className="chip-row">{station.connectors.length ? station.connectors.map((item) => <Chip key={item}>{item}</Chip>) : <Chip>Connector unlisted</Chip>}{station.capacity && <Chip>{station.capacity} bays</Chip>}{station.power_kw && <Chip>{station.power_kw} kW</Chip>}<Chip>{station.confidence || 'Low'} confidence</Chip></div><a className="station-source" href={station.source_url} target="_blank" rel="noreferrer">{station.source || 'OpenStreetMap'} source <ArrowUpRight size={15} /></a></article>)}</div> : <Empty>Run a city crawl to load real charging stations.</Empty>}
      </section>
    </div>
  )
}
