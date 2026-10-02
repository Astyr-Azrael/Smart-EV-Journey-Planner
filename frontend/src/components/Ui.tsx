import type { ReactNode } from 'react'

export function Loading({ label = 'Talking to live data services…' }: { label?: string }) {
  return <div className="loading"><span className="spinner" />{label}</div>
}

export function ErrorNotice({ message }: { message: string }) {
  return <div className="notice error">{message}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>
}

export function Chip({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return <span className={`chip ${dark ? 'dark' : ''}`}>{children}</span>
}
