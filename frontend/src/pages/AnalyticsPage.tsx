import { useEffect, useState } from 'react'
import { Bar, Doughnut } from 'react-chartjs-2'
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { BarChart3, Database, Download } from 'lucide-react'
import { API_URL, api } from '../api'
import { Empty, ErrorNotice, Loading } from '../components/Ui'

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend)
type Pair = [string, number]
type Analytics = { total: number; operators: Pair[]; connectors: Pair[]; charger_types: Pair[]; sources: Pair[]; confidence: Pair[]; completeness: Record<string, number> }
const colors = ['#06d6a0', '#f8ffe5', '#ff3158', '#5f8cff', '#f4ba41', '#a67cff', '#44c2d4', '#84958e']
const chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#cdd7d0', boxWidth: 10 } } }, scales: { x: { ticks: { color: '#87938d' }, grid: { display: false } }, y: { ticks: { color: '#87938d' }, grid: { color: 'rgba(248,255,229,.07)' } } } }

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<Analytics>('/api/analytics').then(setData).catch((err) => setError(err.message)) }, [])
  const pairData = (pairs: Pair[]) => ({ labels: pairs.map(([label]) => label), datasets: [{ data: pairs.map(([, value]) => value), backgroundColor: colors, borderWidth: 0, borderRadius: 6 }] })
  const doughnutOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const, labels: { color: '#cdd7d0', boxWidth: 10 } } } }

  return <div className="stack-lg">
    <section className="analytics-hero pale-panel"><div><p className="eyebrow emerald">PANDAS → SQLITE → CHART.JS</p><h2>Infrastructure,<br /><em>made legible.</em></h2><p>These charts use every station currently collected by the live crawler—not a hand-picked presentation dataset.</p></div><BarChart3 size={88} strokeWidth={1.2} /></section>
    {error && <ErrorNotice message={error} />}
    {!data && !error ? <Loading /> : data && (data.total ? <>
      <section className="completeness-grid">{Object.entries(data.completeness).map(([label, value]) => <article key={label}><strong>{value}%</strong><span>{label} completeness</span><div><i style={{ width: `${value}%` }} /></div></article>)}</section>
      <section className="chart-grid">
        <ChartCard eyebrow="TOP OPERATORS" title="Network footprint"><Bar data={pairData(data.operators)} options={chartOptions} /></ChartCard>
        <ChartCard eyebrow="CONNECTOR MIX" title="Compatibility"><Doughnut data={pairData(data.connectors)} options={doughnutOptions} /></ChartCard>
        <ChartCard eyebrow="DATA ORIGIN" title="Source contribution"><Bar data={pairData(data.sources)} options={chartOptions} /></ChartCard>
        <ChartCard eyebrow="RECORD CONFIDENCE" title="Quality signal"><Doughnut data={pairData(data.confidence)} options={doughnutOptions} /></ChartCard>
      </section>
      <a className="button primary export-button" href={`${API_URL}/api/stations/export.csv`}><Download size={18} /> Export cleaned station CSV</a>
    </> : <Empty><Database /> Crawl a city or plan a journey first; analytics will then use the full stored dataset.</Empty>)}
  </div>
}

function ChartCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <article className="glass-card chart-card"><div className="section-head"><div><p className="eyebrow emerald">{eyebrow}</p><h3>{title}</h3></div></div><div className="chart-box">{children}</div></article>
}
