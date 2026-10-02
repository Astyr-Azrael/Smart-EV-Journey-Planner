import { ArrowUpRight, Braces, Globe2, Layers3, Link2, Radar, ShieldCheck, Sparkles } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { api } from '../api'
import { Chip, ErrorNotice, Loading } from '../components/Ui'

type SelectorDemo = { css_selector: string; css_headings: string[]; xpath_expression: string; xpath_headings: string[]; xpath_engine_available: boolean; candidate_station_cards: string[] }
type CrawlResult = { url: string; title: string; description: string; headings: string[]; links: string[]; structured_data: unknown[]; ev_terms_found: string[]; text_preview: string; word_count: number; selector_demo: SelectorDemo }
type DynamicResult = { url: string; title: string; items: string[]; item_count: number; engine: string }

export default function CrawlerPage() {
  const [mode, setMode] = useState<'static' | 'multipage' | 'dynamic'>('static')
  const [url, setUrl] = useState('https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dcharging_station')
  const [multiUrls, setMultiUrls] = useState('https://wiki.openstreetmap.org/wiki/Tag:amenity%3Dcharging_station\nhttps://wiki.openstreetmap.org/wiki/Key:socket')
  const [waitCss, setWaitCss] = useState('body')
  const [itemCss, setItemCss] = useState('article')
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [multiResult, setMultiResult] = useState<{ pages_completed: number; pages_requested: number; results: CrawlResult[]; errors: Array<{ url: string; error: string }> } | null>(null)
  const [dynamicResult, setDynamicResult] = useState<DynamicResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError(''); setResult(null); setMultiResult(null); setDynamicResult(null)
    try {
      if (mode === 'static') setResult(await api<CrawlResult>('/api/crawler/inspect', { method: 'POST', body: JSON.stringify({ url }) }))
      if (mode === 'multipage') setMultiResult(await api<{ pages_completed: number; pages_requested: number; results: CrawlResult[]; errors: Array<{ url: string; error: string }> }>('/api/crawler/multipage', { method: 'POST', body: JSON.stringify({ urls: multiUrls.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) }) }))
      if (mode === 'dynamic') setDynamicResult(await api<DynamicResult>('/api/crawler/dynamic', { method: 'POST', body: JSON.stringify({ url, wait_css: waitCss, item_css: itemCss, max_items: 20 }) }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Page crawl failed') }
    finally { setLoading(false) }
  }

  return <div className="stack-lg">
    <section className="crawler-hero pale-panel"><div><p className="eyebrow emerald">RESPONSIBLE WEB SCRAPING LAB</p><h2>Inspect a source.<br /><em>Show the method.</em></h2><p>Every mode checks robots.txt and public-network safety first. Static mode demonstrates BeautifulSoup, CSS selectors and XPath; multi-page mode shows throttled pagination; dynamic mode uses Selenium explicit waits.</p></div><ShieldCheck size={92} strokeWidth={1.2} /></section>
    <div className="crawler-tabs"><button className={mode === 'static' ? 'active' : ''} onClick={() => setMode('static')}><Braces />Static + XPath</button><button className={mode === 'multipage' ? 'active' : ''} onClick={() => setMode('multipage')}><Layers3 />Multi-page</button><button className={mode === 'dynamic' ? 'active' : ''} onClick={() => setMode('dynamic')}><Sparkles />Selenium</button></div>
    <form className="glass-card crawler-form" onSubmit={submit}>
      {mode !== 'multipage' ? <label>Public page URL<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} required /></label> : <label>One public page URL per line (maximum 5)<textarea value={multiUrls} onChange={(e) => setMultiUrls(e.target.value)} rows={5} required /></label>}
      {mode === 'dynamic' && <div className="form-grid"><label>Wait for CSS selector<input value={waitCss} onChange={(e) => setWaitCss(e.target.value)} required /></label><label>Extract item selector<input value={itemCss} onChange={(e) => setItemCss(e.target.value)} required /></label></div>}
      <button className="button primary" disabled={loading}><Radar size={18} />{loading ? 'Inspecting…' : mode === 'dynamic' ? 'Run permitted Selenium demo' : 'Run crawler'}</button>
    </form>
    {loading && <Loading label={mode === 'dynamic' ? 'Starting headless Chrome and waiting for dynamic content…' : 'Checking robots.txt and parsing live pages…'} />}{error && <ErrorNotice message={error} />}
    {result && <StaticResult result={result} />}
    {multiResult && <section className="stack-lg"><div className="route-status success"><Layers3 /><div><strong>{multiResult.pages_completed} of {multiResult.pages_requested} pages completed</strong><p>Requests were processed sequentially with a delay to reduce load.</p></div></div>{multiResult.results.map((item) => <StaticResult key={item.url} result={item} compact />)}{multiResult.errors.map((item) => <ErrorNotice key={item.url} message={`${item.url}: ${item.error}`} />)}</section>}
    {dynamicResult && <section className="glass-card"><div className="section-head"><div><p className="eyebrow emerald">{dynamicResult.engine}</p><h3>{dynamicResult.title}</h3></div><Chip dark>{dynamicResult.item_count} visible items</Chip></div><div className="dynamic-items">{dynamicResult.items.map((item, index) => <article key={index}>{item}</article>)}</div></section>}
  </div>
}

function StaticResult({ result, compact = false }: { result: CrawlResult; compact?: boolean }) {
  return <div className="crawl-results"><article className="glass-card crawl-primary"><div className="section-head"><div><p className="eyebrow emerald">PAGE PROFILE</p><h3>{result.title}</h3></div><a href={result.url} target="_blank" rel="noreferrer" className="icon-button"><ArrowUpRight /></a></div><p className="soft-copy">{result.description || result.text_preview}</p><div className="chip-row">{result.ev_terms_found.map((term) => <Chip key={term}>{term}</Chip>)}</div></article>{!compact && <><div className="crawl-stat"><strong>{result.word_count.toLocaleString()}</strong><span>words parsed</span></div><div className="crawl-stat"><strong>{result.links.length}</strong><span>public links found</span></div><div className="crawl-stat"><strong>{result.structured_data.length}</strong><span>JSON-LD blocks</span></div><article className="glass-card selector-proof"><div className="section-head"><div><p className="eyebrow emerald">CSS SELECTOR</p><h3>{result.selector_demo.css_selector}</h3></div><Braces /></div><p>{result.selector_demo.css_headings.slice(0, 5).join(' • ') || 'No headings matched'}</p></article><article className="glass-card selector-proof"><div className="section-head"><div><p className="eyebrow emerald">XPATH {result.selector_demo.xpath_engine_available ? '• LXML' : '• FALLBACK'}</p><h3>{result.selector_demo.xpath_expression}</h3></div><Globe2 /></div><p>{result.selector_demo.xpath_headings.slice(0, 5).join(' • ') || 'No headings matched'}</p></article><article className="glass-card"><div className="section-head"><h3>Link inventory</h3><Link2 /></div><div className="link-list">{result.links.slice(0, 12).map((link) => <a href={link} target="_blank" rel="noreferrer" key={link}>{link}<ArrowUpRight size={14} /></a>)}</div></article></>}</div>
}
