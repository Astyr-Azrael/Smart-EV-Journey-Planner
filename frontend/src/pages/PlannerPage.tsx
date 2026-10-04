import { ArrowRight, Battery, CarFront, Navigation, PlugZap } from 'lucide-react'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import JourneyResults from '../components/JourneyResults'
import PlaceField from '../components/PlaceField'
import { ErrorNotice, Loading } from '../components/Ui'
import type { EVSpec, JourneyResult } from '../types'

const defaults = { origin: 'Mumbai', destination: 'Pune', origin_latitude: null as number | null, origin_longitude: null as number | null, destination_latitude: null as number | null, destination_longitude: null as number | null, ev_id: 'tata-nexon-ev-45', start_soc: '85', arrival_soc: '15' }

export default function PlannerPage() {
  const [form, setForm] = useState(defaults)
  const [evs, setEvs] = useState<EVSpec[]>([])
  const [manufacturer, setManufacturer] = useState('Tata')
  const [result, setResult] = useState<JourneyResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const set = (key: string, value: string | number | null) => setForm((state) => ({ ...state, [key]: value }))
  const setPlace = (key: 'origin' | 'destination', value: string, place?: { latitude: number; longitude: number }) => setForm((state) => ({
    ...state,
    [key]: value,
    [`${key}_latitude`]: place?.latitude ?? null,
    [`${key}_longitude`]: place?.longitude ?? null,
  }))
  const setSoc = (key: 'start_soc' | 'arrival_soc', value: string) => {
    set(key, value.replace(/\D/g, '').slice(0, 3))
    setError('')
  }

  useEffect(() => {
    api<EVSpec[]>('/api/evs').then((rows) => {
      setEvs(rows)
      const selected = rows.find((item) => item.ev_id === defaults.ev_id) || rows[0]
      if (selected) { setManufacturer(selected.manufacturer); setForm((state) => ({ ...state, ev_id: selected.ev_id })) }
    }).catch((err) => setError(err.message))
  }, [])

  const manufacturers = useMemo(() => [...new Set(evs.map((item) => item.manufacturer))], [evs])
  const visibleEvs = evs.filter((item) => item.manufacturer === manufacturer)
  const selectedEv = evs.find((item) => item.ev_id === form.ev_id)

  function changeManufacturer(value: string) {
    setManufacturer(value)
    const first = evs.find((item) => item.manufacturer === value)
    if (first) set('ev_id', first.ev_id)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const startSoc = Number(form.start_soc)
    const arrivalSoc = Number(form.arrival_soc)
    if (!Number.isInteger(startSoc) || startSoc < 10 || startSoc > 100) { setError('Starting charge must be a whole number from 10% to 100%.'); return }
    if (!Number.isInteger(arrivalSoc) || arrivalSoc < 5 || arrivalSoc > 99) { setError('Arrival reserve must be a whole number from 5% to 99%.'); return }
    if (arrivalSoc >= startSoc) { setError('Arrival reserve must be lower than the starting charge. For example, use 100% starting charge to request a 90% arrival reserve.'); return }
    setLoading(true); setError(''); setResult(null)
    try { setResult(await api<JourneyResult>('/api/journeys/plan', { method: 'POST', body: JSON.stringify({ ...form, start_soc: startSoc, arrival_soc: arrivalSoc }) })) }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not plan the journey') }
    finally { setLoading(false) }
  }

  return <div className="stack-lg">
    <section className="planner-layout">
      <form className="glass-card planner-form" onSubmit={submit}>
        <div className="section-head"><div><p className="eyebrow emerald">YOUR JOURNEY</p><h2>Where do you want to go?</h2></div><Navigation /></div>
        <PlaceField id="origin-place" label="Starting point" value={form.origin} onChange={(value, place) => setPlace('origin', value, place)} />
        <PlaceField id="destination-place" label="Destination" value={form.destination} onChange={(value, place) => setPlace('destination', value, place)} />
        <div className="form-grid">
          <label>Manufacturer<select value={manufacturer} onChange={(event) => changeManufacturer(event.target.value)}>{manufacturers.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label>EV model / variant<select value={form.ev_id} onChange={(event) => set('ev_id', event.target.value)}>{visibleEvs.map((item) => <option key={item.ev_id} value={item.ev_id}>{item.model} — {item.variant}</option>)}</select></label>
          <label>Starting charge (%)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={3} value={form.start_soc} onChange={(event) => setSoc('start_soc', event.target.value)} placeholder="10–100" aria-describedby="charge-help" /></label>
          <label>Arrival reserve (%)<input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2} value={form.arrival_soc} onChange={(event) => setSoc('arrival_soc', event.target.value)} placeholder="5–99" aria-describedby="charge-help" /></label>
        </div>
        <p className="form-note" id="charge-help">Type the percentages directly. Arrival reserve may be as high as 99%, but it must stay below the starting charge.</p>
        <button className="button primary wide" disabled={loading || !selectedEv}>{loading ? 'Finding routes and stations…' : <>Plan my journey <ArrowRight size={18} /></>}</button>
        <p className="form-note">Plan anywhere in India with the nationwide EV Yatra station data. Live availability and tariffs may be unavailable; confirm a charger before travel.</p>
      </form>
      <aside className="planner-side pale-panel">
        <p className="eyebrow emerald">SELECTED EV</p>
        {selectedEv ? <><h3>{selectedEv.manufacturer}<br /><em>{selectedEv.model} {selectedEv.variant}</em></h3><div className="spec-list"><div><Battery /><span><small>Battery</small><strong>{selectedEv.battery_kwh} kWh</strong></span></div><div><CarFront /><span><small>Certified range</small><strong>{selectedEv.certified_range_km} km</strong></span></div><div><PlugZap /><span><small>DC connector</small><strong>{selectedEv.dc_connector}</strong></span></div></div><a className="text-link" href={selectedEv.source_url} target="_blank" rel="noreferrer">Official specification source <ArrowRight /></a></> : <p>Loading verified EV specifications…</p>}
      </aside>
    </section>
    {loading && <Loading label="Comparing routes and discovering charging stations…" />}
    {error && <ErrorNotice message={error} />}
    {result && <JourneyResults result={result} />}
  </div>
}
