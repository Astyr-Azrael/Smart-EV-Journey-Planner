export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export class ApiError extends Error {}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(body?.detail || `Request failed (${response.status})`)
  }
  return body as T
}
