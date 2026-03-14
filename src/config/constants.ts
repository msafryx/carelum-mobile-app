// App-wide constants

export const APP_NAME = 'Carelum';

/** Display currency (Sri Lankan Rupees) */
export const CURRENCY_SYMBOL = 'Rs.';
export const CURRENCY_CODE = 'LKR';

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
  INTERVIEW_SCHEDULED: 'interview_scheduled',
  INTERVIEW_COMPLETED: 'interview_completed',
  ACCEPTED: 'accepted',
  PAYMENT_PENDING: 'payment_pending',
  BOOKED: 'booked',
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
  // Sessions
  SESSIONS: '/api/sessions',
  SESSION_BY_ID: (id: string) => `/api/sessions/${id}`,
  SESSION_REPORT: (id: string) => `/api/sessions/${id}/report`,
  SESSION_EMERGENCY_INFO: (id: string) => `/api/sessions/${id}/emergency-info`,
  SESSION_EMERGENCY_CALL: (id: string) => `/api/sessions/${id}/emergency-call`,
  SESSION_START: (id: string) => `/api/sessions/${id}/start`,
  SESSION_MONITORING: (id: string) => `/api/sessions/${id}/monitoring`,
  SESSION_END: (id: string) => `/api/sessions/${id}/end`,
  SESSION_EVENTS: (id: string) => `/api/sessions/${id}/events`,
  SESSION_REQUEST_END: (id: string) => `/api/sessions/${id}/request-end`,
  SESSION_ALERTS: (id: string) => `/api/sessions/${id}/alerts`,
  SESSION_GPS: (id: string) => `/api/gps/sessions/${id}/gps`,
  SESSION_GPS_LATEST: (id: string) => `/api/gps/sessions/${id}/gps/latest`,
  // Children
  CHILDREN: '/api/children',
  CHILD_BY_ID: (id: string) => `/api/children/${id}`,
  CHILD_INSTRUCTIONS: (id: string) => `/api/children/${id}/instructions`,
  CHILD_ASSISTANT: '/api/child-assistant',
  // Alerts
  ALERTS: '/api/alerts',
  ALERT_BY_ID: (id: string) => `/api/alerts/${id}`,
  ALERT_VIEW: (id: string) => `/api/alerts/${id}/view`,
  ALERT_ACKNOWLEDGE: (id: string) => `/api/alerts/${id}/acknowledge`,
  ALERT_RESOLVE: (id: string) => `/api/alerts/${id}/resolve`,
  // GPS
  GPS_TRACK: '/api/gps/track',
  // Messages
  SESSION_MESSAGES: (id: string) => `/api/sessions/${id}/messages`,
  MESSAGE_READ: (id: string) => `/api/messages/${id}/read`,
  // Payments (Stripe)
  PAYMENTS_CREATE_CUSTOMER: '/api/payments/create-customer',
  PAYMENTS_CREATE_INTENT: '/api/payments/create-intent',
  PAYMENTS_CAPTURE: '/api/payments/capture',
  // Sitter payout (Stripe Connect)
  SITTERS_CREATE_STRIPE_ACCOUNT: '/api/sitters/create-stripe-account',
  SITTERS_ONBOARDING_LINK: '/api/sitters/onboarding-link',
  // Interviews (video call)
  INTERVIEWS_SCHEDULE: '/api/interviews/schedule',
  INTERVIEWS_BY_SESSION: (sessionId: string) => `/api/interviews/session/${sessionId}`,
  INTERVIEW_BY_ID: (id: string) => `/api/interviews/${id}`,
  INTERVIEW_COMPLETE: (id: string) => `/api/interviews/${id}/complete`,
  // Pre-booking meeting requests (video call before sending session request)
  MEETING_REQUESTS: '/api/meeting-requests',
  MEETING_REQUEST_BY_ID: (id: string) => `/api/meeting-requests/${id}`,
  MEETING_REQUEST_ACCEPT: (id: string) => `/api/meeting-requests/${id}/accept`,
  MEETING_REQUEST_DECLINE: (id: string) => `/api/meeting-requests/${id}/decline`,
  MEETING_REQUEST_COMPLETE: (id: string) => `/api/meeting-requests/${id}/complete`,
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
