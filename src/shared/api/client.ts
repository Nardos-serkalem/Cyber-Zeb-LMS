import axios from 'axios'

import {
  AUTH_TOKEN_KEY,
  DEFAULT_TENANT_CODE,
  LEGACY_AUTH_TOKEN_KEY,
} from './collectionKeys'
import { getCookie, removeCookie, setCookie } from '../storage/cookies'
import { getActiveTenant } from '../config/tenant'

/** The tenant code the data layer talks to — the active institution, or the demo tenant. */
export function activeTenantCode(): string {
  return getActiveTenant()?.slug || DEFAULT_TENANT_CODE
}

// In Vite, always go through the /api proxy so a stale .env.local (e.g. :8000)
// cannot send the browser to a dead port. Production still honors VITE_API_BASE_URL.
const API_BASE = import.meta.env.DEV
  ? '/api/v1'
  : (import.meta.env.VITE_API_BASE_URL ?? '/api/v1')
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days (JWT may expire sooner)

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'X-Tenant-Code': DEFAULT_TENANT_CODE,
  },
})

function migrateLegacyToken(): string | null {
  const legacy = window.localStorage.getItem(LEGACY_AUTH_TOKEN_KEY)
  if (!legacy) return null
  setCookie(AUTH_TOKEN_KEY, legacy, { maxAgeSeconds: TOKEN_MAX_AGE_SECONDS })
  window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  return legacy
}

export function getAccessToken(): string | null {
  return getCookie(AUTH_TOKEN_KEY) ?? migrateLegacyToken()
}

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // Route data calls to the active institution's tenant (falls back to demo).
  config.headers['X-Tenant-Code'] = activeTenantCode()
  return config
})

export function setAccessToken(token: string | null) {
  if (token) {
    setCookie(AUTH_TOKEN_KEY, token, { maxAgeSeconds: TOKEN_MAX_AGE_SECONDS })
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  } else {
    removeCookie(AUTH_TOKEN_KEY)
    window.localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY)
  }
}
