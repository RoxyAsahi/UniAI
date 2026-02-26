import axios from 'axios'

const instance = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// Attach JWT token from localStorage on every request
instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('uqa_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err?.response?.data ?? err)
)

export default instance
