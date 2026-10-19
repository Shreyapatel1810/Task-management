import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach the JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is rejected mid-session, send the user back to login
const AUTH_URLS = ['/auth/login', '/auth/register', '/auth/me'];
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !AUTH_URLS.includes(err.config.url)) {
      localStorage.removeItem('token');
     // window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;