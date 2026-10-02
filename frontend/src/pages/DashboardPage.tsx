import { ArrowRight, BatteryCharging, Database, Leaf, Route, Satellite, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Empty, ErrorNotice, Loading } from '../components/Ui'
import type { DashboardData } from '../types'

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<DashboardData>('/api/dashboard').then(setData).catch((err) => setError(err.message)) }, [])
  return (
    <div className="stack-lg">
      <section className="hero-grid">
        <article className="hero-card pale-panel">
          <div className="hero-copy">
            <p className="eyebrow emerald">LIVE • EXPLAINABLE • OPEN DATA</p>
            <h2>Go farther.<br />Charge <em>smarter.</em></h2>
            <p>Plan reliable EV journeys with road-aware range checks and chargers crawled live from the open map.</p>
            <div className="hero-actions"><Link className="button primary" to="/plan">Plan a journey <ArrowRight size={17} /></Link><Link className="text-link" to="/sources">See our data</Link></div>
          </div>
          <div className="range-orbit"><span>LIVE RANGE</span><strong>360</strong><small>km ready</small><Zap className="orbit-icon" /></div>
        </article>
        <article className="hero-card emerald-panel">
          <div className="network-art"><span className="road road-one" /><span className="road road-two" /><span className="charge-node n1"><Zap /></span><span className="charge-node n2"><Zap /></span><span className="charge-node n3"><Zap /></span></div>
          <div className="hero-copy bottom"><p className="eyebrow">THE NETWORK, UNCOVERED</p><h3>Real stations.<br />Real routes.</h3><Link className="round-button" to="/network" aria-label="Open charging network"><ArrowRight /></Link></div>
        </article>
      </section>

      {error && <ErrorNotice message={`${error}. Start the API with the command in README.md.`} />}
      {!data && !error ? <Loading /> : data && <>
        <section className="metric-grid">
          <div className="metric-card"><span className="metric-icon"><BatteryCharging /></span><div><strong>{data.stations_indexed.toLocaleString()}</strong><p>Stations indexed</p></div><small>live OSM records</small></div>
          <div className="metric-card"><span className="metric-icon"><Route /></span><div><strong>{data.journeys_planned}</strong><p>Routes planned</p></div><small>saved locally</small></div>
          <div className="metric-card"><span className="metric-icon"><Database /></span><div><strong>{data.data_providers}</strong><p>Data services</p></div><small>fully attributed</small></div>
          <div className="metric-card"><span className="metric-icon"><Satellite /></span><div><strong>{data.last_crawl ? 'Fresh' : 'Ready'}</strong><p>Crawler status</p></div><small>{data.last_crawl ? new Date(data.last_crawl).toLocaleString() : 'waiting for first crawl'}</small></div>
        </section>
        <section className="two-col">
          <article className="glass-card">
            <div className="section-head"><div><p className="eyebrow">RECENT ACTIVITY</p><h3>Your journeys</h3></div><Link to="/journeys" className="text-link">View all</Link></div>
            {data.recent_journeys.length ? <div className="journey-list">{data.recent_journeys.map((journey) => <div className="journey-row" key={journey.id}><span className="route-bullet"><Route /></span><div><strong>{journey.origin.split(',')[0]} → {journey.destination.split(',')[0]}</strong><p>{journey.distance_km} km · {new Date(journey.created_at).toLocaleDateString()}</p></div><ArrowRight size={18} /></div>)}</div> : <Empty>No journeys yet. Your first route will appear here.</Empty>}
          </article>
          <article className="glass-card manifesto"><Leaf /><p className="eyebrow emerald">DESIGNED FOR CONFIDENCE</p><h3>No mystery data.</h3><p>Every charger links back to its OpenStreetMap record. Every journey includes a fetch timestamp and source attribution.</p><Link className="button secondary" to="/crawler">Explore crawler</Link></article>
        </section>
      </>}
    </div>
  )
}
