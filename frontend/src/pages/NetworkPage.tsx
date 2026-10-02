import { ArrowRight, BatteryCharging, MapPin, Search } from 'lucide-react'
import { FormEvent, useMemo, useState } from 'react'
import { api } from '../api'
import RouteMap from '../components/RouteMap'
import { Chip, Empty, ErrorNotice, Loading } from '../components/Ui'
import type { Station } from '../types'

export default function NetworkPage() {
  const [stations, setStations] = useState<Station[]>([])
  const [place, setPlace] = useState('Mumbai')
  const [radius, setRadius] = useState(10)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function findStations(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setStations([])
    try { const result = await api<{ stations: Station[] }>('/api/crawl/stations', { method: 'POST', body: JSON.stringify({ place, radius_km: radius }) }); setStations(result.stations) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not find charging stations') }
    finally { setLoading(false) }
  }
  const filtered = useMemo(() => stations.filter((station) => `${station.name} ${station.operator || ''}`.toLowerCase().includes(query.toLowerCase())), [stations, query])
  return <div className="stack-lg"><section className="network-hero emerald-panel"><div><p className="eyebrow">NEAREST CHARGING STATION</p><h2>Find chargers<br />around you.</h2><p>Searches OpenStreetMap live, cleans duplicate records and keeps every source link.</p></div><form onSubmit={findStations} className="network-search"><label>City or place<input value={place} onChange={(event) => setPlace(event.target.value)} required /></label><label>Search radius<select value={radius} onChange={(event) => setRadius(+event.target.value)}><option value="5">5 km</option><option value="10">10 km</option><option value="25">25 km</option><option value="50">50 km</option></select></label><button className="button pale-button" disabled={loading}><Search />{loading ? 'Searching…' : 'Find charging stations'}</button></form></section>{loading && <Loading label={`Finding charging stations around ${place}…`} />}{error && <ErrorNotice message={error} />}{stations.length ? <><RouteMap stations={filtered} className="network-map" /><section className="glass-card"><div className="section-head"><div><p className="eyebrow emerald">NEARBY NETWORK</p><h2>{stations.length} stations found</h2></div><input className="search-box" placeholder="Filter by name or operator" value={query} onChange={(event) => setQuery(event.target.value)} /></div><div className="station-detail-grid">{filtered.map((station) => <article className="station-detail-card" key={station.osm_key}><div className="station-card-head"><div><p className="eyebrow emerald">{station.opening_hours === '24/7' ? 'OPEN 24/7' : 'STATUS UNAVAILABLE'}</p><h3>{station.name}</h3><span>{station.operator || 'Operator not listed'}</span></div><a href={station.source_url} target="_blank" rel="noreferrer"><ArrowRight /></a></div><p className="station-address"><MapPin />{station.address || `${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}`}</p><div className="chip-row">{station.connectors.length ? station.connectors.map((item) => <Chip key={item}>{item}</Chip>) : <Chip>Connector not listed</Chip>}{station.power_kw ? <Chip>{station.power_kw} kW</Chip> : null}{station.capacity ? <Chip>{station.capacity} bays</Chip> : null}</div></article>)}</div>{!filtered.length ? <Empty>No stations match that filter.</Empty> : null}</section></> : !loading && !error ? <Empty><BatteryCharging /> Enter a place to find its nearest mapped charging stations.</Empty> : null}</div>
}
