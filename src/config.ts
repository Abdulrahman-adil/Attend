// src/config.ts
export const API_URL = import.meta.env.PROD
  ? 'https://attend-api-f60m.onrender.com/api'
  : '/api';
