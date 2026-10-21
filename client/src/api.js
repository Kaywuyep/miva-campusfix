import axios from 'axios';

// All API calls go through this instance. The JWT is attached automatically.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the session has expired, clear it and send the user back to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.location.href = '/login?expired=1';
    }
    return Promise.reject(err);
  }
);

// Turn any API error into a readable message for the UI
export function errorMessage(err) {
  const data = err?.response?.data;
  if (data?.errors?.length) return data.errors.map((e) => e.message).join('. ');
  return data?.message || err?.message || 'Something went wrong';
}

export default api;
