const API_BASE = "https://visa-atlas.vercel.app";

export const endpoints = {
  generateTrip: `${API_BASE}/api/generate-trip`,
  generateMultiTrip: `${API_BASE}/api/generate-multi-trip`,
  compare: `${API_BASE}/api/compare`,
  surprise: `${API_BASE}/api/surprise`,
  feed: `${API_BASE}/api/feed`,
  tripChat: `${API_BASE}/api/trip-chat`,
  visaChat: `${API_BASE}/api/visa-chat`,
  visaGuide: `${API_BASE}/api/visa-guide`,
  unsplash: `${API_BASE}/api/unsplash`,
  gmailAuth: `${API_BASE}/api/auth/gmail`,
  gmailCallback: `${API_BASE}/api/auth/gmail/callback`,
  scanBooking: `${API_BASE}/api/scan-booking`,
  visaMap: `${API_BASE}/api/visa-map`,
};
