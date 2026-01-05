export type SessionStatus = 'requested' | 'accepted' | 'active' | 'completed' | 'cancelled';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: Date;
  accuracy?: number;
  altitude?: number;
  speed?: number;
}

export interface Session {
  id: string;
  parentId: string;
  sitterId: string;
  childId: string;
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in hours
  
  // Location
  location?: {
    address: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  
  // Payment
  hourlyRate: number;
  totalAmount?: number;
  paymentStatus?: 'pending' | 'paid' | 'refunded';
  
  // Session Data
  instructions?: string;
  specialNotes?: string;
  
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
