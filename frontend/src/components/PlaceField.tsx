import { MapPin } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { api } from '../api'

type Place = { label: string; latitude: number; longitude: number }

export default function PlaceField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [focused, setFocused] = useState(false)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [activeIndex, setActiveIndex] = useState(-1)
  const selectedLabel = useRef('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const query = value.trim()
    if (!focused || query.length < 2 || query === selectedLabel.current) {
      setOpen(false)
      return
    }
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setStatus('loading')
      setOpen(true)
      api<Place[]>(`/api/places/suggest?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((items) => { setSuggestions(items); setStatus('ready'); setActiveIndex(-1) })
        .catch(() => { if (!controller.signal.aborted) { setSuggestions([]); setStatus('error') } })
    }, 300)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [focused, value])

  function select(place: Place) {
    selectedLabel.current = place.label
    onChange(place.label)
    setOpen(false)
    setActiveIndex(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || !suggestions.length) {
      if (event.key === 'Escape') setOpen(false)
      return
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => (index + 1) % suggestions.length) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => index <= 0 ? suggestions.length - 1 : index - 1) }
    if (event.key === 'Enter') { event.preventDefault(); select(suggestions[Math.max(activeIndex, 0)]) }
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false) }
  }

  return <div className="place-field">
    <label htmlFor={id}>{label}</label>
    <div className="input-icon">
      <MapPin aria-hidden="true" />
      <input id={id} value={value} onChange={(event) => { selectedLabel.current = ''; onChange(event.target.value) }}
        onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); setOpen(false) }} onKeyDown={onKeyDown}
        role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-suggestions`}
        aria-activedescendant={activeIndex >= 0 && open ? `${id}-suggestion-${activeIndex}` : undefined}
        autoComplete="off" placeholder="Search a place in India" required />
      {open && <div id={`${id}-suggestions`} role="listbox" className="place-suggestions">
        {status === 'loading' && <p className="place-suggestion-note">Searching places…</p>}
        {status === 'error' && <p className="place-suggestion-note">Suggestions unavailable. You can enter a place manually.</p>}
        {status === 'ready' && suggestions.length === 0 && <p className="place-suggestion-note">No matches found. You can enter a place manually.</p>}
        {status === 'ready' && suggestions.map((place, index) => <button id={`${id}-suggestion-${index}`} key={`${place.label}-${index}`} type="button" role="option"
          aria-selected={index === activeIndex} className={index === activeIndex ? 'active' : ''}
          onMouseDown={(event) => event.preventDefault()} onClick={() => select(place)}>{place.label}</button>)}
      </div>}
    </div>
  </div>
}
