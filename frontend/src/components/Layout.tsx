import { Activity, BarChart3, BatteryCharging, Database, History, Menu, Radar, Route, Settings2, X, Zap } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Overview', icon: Activity },
  { to: '/plan', label: 'Plan a journey', icon: Route },
  { to: '/network', label: 'Charging network', icon: BatteryCharging },
  { to: '/crawler', label: 'Web crawler', icon: Radar },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/journeys', label: 'Journey history', icon: History },
  { to: '/sources', label: 'Data sources', icon: Database },
]

const titles: Record<string, string> = {
  '/': 'Mobility overview',
  '/plan': 'Plan your journey',
  '/network': 'Charging network',
  '/crawler': 'Web intelligence',
  '/analytics': 'Infrastructure analytics',
  '/journeys': 'Journey history',
  '/sources': 'Source transparency',
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><span>VoltPath</span></div>
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        <p className="nav-caption">Workspace</p>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-card">
          <span className="live-dot" /> Live data mode
          <p>Chargers are fetched from OpenStreetMap—not a demo list.</p>
        </div>
        <div className="sidebar-foot"><Settings2 size={16} /><span>API v1.0</span></div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div><p className="eyebrow">SMART EV JOURNEY PLANNER</p><h1>{titles[location.pathname] || 'VoltPath'}</h1></div>
          <div className="system-pill"><span className="live-dot" /> Systems online</div>
        </header>
        <div className="page"><Outlet /></div>
      </main>
    </div>
  )
}
