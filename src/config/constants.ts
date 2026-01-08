// App-wide constants

export const APP_NAME = 'Carelum';

export const USER_ROLES = {
  PARENT: 'parent',
  BABYSITTER: 'babysitter',
  ADMIN: 'admin',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const LANGUAGES = {
  ENGLISH: 'en',
  SINHALA: 'si',
  TAMIL: 'ta',
} as const;

export type Language = typeof LANGUAGES[keyof typeof LANGUAGES];

export const VERIFICATION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type VerificationStatus = typeof VERIFICATION_STATUS[keyof typeof VERIFICATION_STATUS];

export const SESSION_STATUS = {
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export type SessionStatus = typeof SESSION_STATUS[keyof typeof SESSION_STATUS];

export const ALERT_TYPES = {
  CRYING_DETECTED: 'CRYING_DETECTED',
} as const;

export type AlertType = typeof ALERT_TYPES[keyof typeof ALERT_TYPES];

// Firestore collection names
export const COLLECTIONS = {
  USERS: 'users',
  BABYSITTERS: 'babysitters',
  VERIFICATION_REQUESTS: 'verificationRequests',
  SESSIONS: 'sessions',
  AUDIO_LOGS: 'audioLogs',
  ALERTS: 'alerts',
  CHILD_INSTRUCTIONS: 'childInstructions',
  CHAT_HISTORY: 'chatHistory',
} as const;

// Storage paths
export const STORAGE_PATHS = {
  DOCUMENTS: 'documents',
  PROFILE_IMAGES: 'profileImages',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  PREDICT: '/predict',
  BOT_UPDATE: '/bot/update',
  BOT_ASK: '/bot/ask',
  // User endpoints
  USER_PROFILE: '/api/users/me',
  // Admin endpoints
  ADMIN_USERS: '/api/admin/users',
  ADMIN_STATS: '/api/admin/stats',
} as const;

// Audio monitoring constants
export const AUDIO_CHUNK_DURATION = 3000; // 3 seconds in milliseconds
export const CRYING_THRESHOLD = 0.7; // Default threshold for crying detection
export const ALERT_DURATION = 10000; // 10 seconds of continuous crying

// GPS tracking constants
export const LOCATION_UPDATE_INTERVAL = 30000; // 30 seconds
export const LOCATION_ACCURACY = {
  high: 10, // meters
  medium: 50,
  low: 100,
} as const;
