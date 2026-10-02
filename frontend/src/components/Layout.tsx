import { BatteryCharging, Database, History, Home, Menu, Route, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'

const journeyLinks = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/plan', label: 'Plan a journey', icon: Route },
  { to: '/journeys', label: 'Journey history', icon: History },
  { to: '/sources', label: 'Data sources', icon: Database },
]

const networkLinks = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/network', label: 'Nearest charging station', icon: BatteryCharging },
]

const titles: Record<string, string> = {
  '/plan': 'Plan your journey',
  '/network': 'Nearest charging station',
  '/journeys': 'Journey history',
  '/sources': 'Source transparency',
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  if (location.pathname === '/') return <Outlet />
  const links = location.pathname.startsWith('/network') ? networkLinks : journeyLinks
  const title = location.pathname.startsWith('/journeys/') ? 'Journey details' : titles[location.pathname]
  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close menu"><X /></button>
        <p className="nav-caption">SMART EV JOURNEY PLANNER</p>
        <nav>
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}>
              <Icon size={18} /> <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></button>
          <div><p className="eyebrow">SMART EV JOURNEY PLANNER</p><h1>{title || 'Journey planner'}</h1></div>
        </header>
        <div className="page"><Outlet /></div>
      </main>
    </div>
  )
}
