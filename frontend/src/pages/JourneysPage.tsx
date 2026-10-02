import { ArrowRight, CalendarDays, Clock3, Route } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { Empty, ErrorNotice, Loading } from '../components/Ui'

type Journey = { id: number; origin: string; destination: string; distance_km: number; duration_minutes: number; vehicle: string; created_at: string }

export default function JourneysPage() {
  const [rows, setRows] = useState<Journey[] | null>(null); const [error, setError] = useState('')
  useEffect(() => { api<Journey[]>('/api/journeys').then(setRows).catch((err) => setError(err.message)) }, [])
  return <div className="stack-lg"><section className="page-intro"><p className="eyebrow emerald">LOCAL JOURNEY LOG</p><h2>Every plan, kept in view.</h2><p>Saved route summaries make the project auditable without storing private account information.</p></section>{error && <ErrorNotice message={error} />}{rows === null && !error ? <Loading /> : rows && <section className="history-list">{rows.length ? rows.map((row) => <article className="history-card" key={row.id}><span className="history-route"><Route /></span><div className="history-main"><h3>{row.origin.split(',')[0]} <ArrowRight size={19} /> {row.destination.split(',')[0]}</h3><div><span><CalendarDays />{new Date(row.created_at).toLocaleString()}</span><span><Clock3 />{Math.round(row.duration_minutes)} min drive</span></div></div><div className="history-distance"><strong>{row.distance_km}</strong><span>km</span></div></article>) : <Empty>No saved journeys yet. <Link to="/plan">Plan your first route.</Link></Empty>}</section>}</div>
}
