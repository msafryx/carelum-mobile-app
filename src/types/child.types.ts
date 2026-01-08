export interface Child {
  id: string;
  parentId: string;
  childNumber?: string; // Readable ID: c1, c2, c3...
  parentNumber?: string; // Parent's userNumber: p1, p2, p3...
  sitterNumber?: string; // Sitter's userNumber: b1, b2, b3... (if assigned)
  name: string;
  age: number;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'other';
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChildInstructions {
  id: string;
  childId: string;
  parentId: string;
  
  // Basic care
  feedingSchedule?: string;
  napSchedule?: string;
  bedtime?: string;
  dietaryRestrictions?: string;
  allergies?: string[];
  medications?: Array<{
    name: string;
    dosage: string;
    time: string;
    notes?: string;
  }>;
  
  // Preferences
  favoriteActivities?: string[];
  comfortItems?: string[];
  routines?: string;
  specialNeeds?: string;
  
  // Emergency
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    phone: string;
    notes?: string;
  }>;
  doctorInfo?: {
    name: string;
    phone: string;
    clinic?: string;
  };
  
  // Additional notes
  additionalNotes?: string;
  
  createdAt: Date;
  updatedAt: Date;
}
