import { ArrowUpRight, CheckCircle2, Database, Route, Search, Server, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../api'
import { ErrorNotice, Loading } from '../components/Ui'

type Sources = { sources: Array<{ name: string; role: string; url: string; method: string }>; scraping?: Array<{ name: string; method: string; policy: string }>; policy: string }

export default function SourcesPage() {
  const [data, setData] = useState<Sources | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<Sources>('/api/sources').then(setData).catch((err) => setError(err.message)) }, [])
  const icons = [Database, Search, Route]
  return <div className="stack-lg"><section className="source-hero emerald-panel"><div><p className="eyebrow">SOURCE TRANSPARENCY</p><h2>Open data in.<br />Useful routes out.</h2><p>The planner does not claim that a charger is available right now. It shows source links, fetch time and known metadata so users can verify before travel.</p></div><Server size={92} strokeWidth={1.15} /></section>{error && <ErrorNotice message={error} />}{!data && !error ? <Loading /> : data && <><div className="source-grid">{data.sources.map((source, index) => { const Icon = icons[index] || Database; return <article className="source-card" key={source.name}><span><Icon /></span><p className="eyebrow emerald">{source.method}</p><h3>{source.name}</h3><p>{source.role}</p><a href={source.url} target="_blank" rel="noreferrer">Open endpoint <ArrowUpRight size={15} /></a></article> })}</div>{data.scraping && <section className="scraping-methods">{data.scraping.map((item) => <article className="glass-card" key={item.name}><p className="eyebrow emerald">{item.method}</p><h3>{item.name}</h3><p>{item.policy}</p></article>)}</section>}<section className="glass-card data-policy"><ShieldCheck /><div><p className="eyebrow emerald">DATA POLICY</p><h3>Built for honest demos.</h3><p>{data.policy}</p><ul><li><CheckCircle2 />Server-side calls avoid exposing credentials.</li><li><CheckCircle2 />Default routing remains available when station providers fail.</li><li><CheckCircle2 />The backend crawler blocks local networks and respects robots.txt.</li><li><CheckCircle2 />Every charger preserves its source URL and fetch timestamp.</li></ul></div></section></>}</div>
}
