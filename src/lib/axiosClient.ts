import axios from 'axios'

const baseURL = import.meta.env.DEV
  ? '/api/v1'
  : (import.meta.env.VITE_API_BASE_URL ?? '/api/v1')

export const axiosClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('berana_super_admin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.error?.message ??
      error?.message ??
      'Request failed'
    return Promise.reject(new Error(message))
  },
)
