export type SessionStatus = 'requested' | 'accepted' | 'active' | 'completed' | 'cancelled';

export type SessionSearchScope = 'invite' | 'nearby' | 'city' | 'nationwide';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  altitude?: number;
  speed?: number;
}

export interface TimeSlot {
  date: string; // Date string in format "YYYY-MM-DD" or "MMM dd, yyyy"
  startTime: string; // Time string in format "HH:mm" or ISO string
  endTime: string; // Time string in format "HH:mm" or ISO string
  hours: number; // Duration in hours
}

export interface Session {
  id: string;
  parentId: string;
  sitterId: string;
  childId: string; // Primary child (for backward compatibility)
  childIds?: string[]; // Array of child IDs for sessions with multiple children
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in hours
  timeSlots?: TimeSlot[]; // Array of time slots for multi-day sessions (Time Slots mode)
  
  // Location
  location?: {
    address: string;
    city?: string; // Extracted city for city-wide search matching
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Multi-scope session requests
  searchScope?: SessionSearchScope; // 'invite' | 'nearby' | 'city' | 'nationwide'
  maxDistanceKm?: number; // Only used when searchScope = 'nearby' (5, 10, or 25 km)
  
  // Payment
  hourlyRate: number;
  totalAmount?: number;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
  
  // Session Data
  instructions?: string;
  specialNotes?: string;
  notes?: string; // Session notes/comments
  
  // Tracking
  gpsTrackingEnabled?: boolean;
  lastLocationUpdate?: Date;
  currentLocation?: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  
  // AI Monitoring
  monitoringEnabled?: boolean;
  cryDetectionEnabled?: boolean;
  lastCryDetection?: Date;
  cryAlertsCount?: number;
  
  // Completion
  completedAt?: Date;
  parentRating?: number;
  parentReview?: string;
  sitterRating?: number;
  sitterReview?: string;
  
  // Cancellation
  cancelledAt?: Date;
  cancelledBy?: 'parent' | 'sitter';
  cancellationReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
