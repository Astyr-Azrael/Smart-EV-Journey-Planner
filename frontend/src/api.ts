export const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

export class ApiError extends Error {}

function errorMessage(detail: unknown, fallback: string) {
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object' && 'msg' in item) return String(item.msg)
      return ''
    }).filter(Boolean)
    if (messages.length) return messages.join(' ')
  }
  if (detail && typeof detail === 'object' && 'message' in detail) return String(detail.message)
  return fallback
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 65000)
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      signal: options?.signal || controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new ApiError(errorMessage(body?.detail, `Request failed (${response.status})`))
    return body as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError('The live data request timed out. Please try again.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
