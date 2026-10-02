import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import JourneyResults from '../components/JourneyResults'
import { ErrorNotice, Loading } from '../components/Ui'
import type { JourneyResult } from '../types'

export default function JourneyDetailPage() {
  const { journeyId } = useParams()
  const [result, setResult] = useState<JourneyResult | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { api<JourneyResult>(`/api/journeys/${journeyId}`).then(setResult).catch((err) => setError(err.message)) }, [journeyId])
  return <div className="stack-lg"><Link className="text-link" to="/journeys">← Back to journey history</Link>{!result && !error ? <Loading label="Opening saved journey…" /> : null}{error ? <ErrorNotice message={error} /> : null}{result ? <JourneyResults result={result} /> : null}</div>
}
