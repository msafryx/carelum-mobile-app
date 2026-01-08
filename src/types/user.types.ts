import { Language, UserRole } from '@/src/config/constants';

export interface User {
  id: string; // Firebase UID (primary key)
  userNumber?: string; // Readable ID: p1, p2, b1, b2, a1, a2
  email: string;
  role: UserRole;
  preferredLanguage: Language;
  displayName: string;
  createdAt: Date;
  updatedAt?: Date;
  profileImageUrl?: string;
  phoneNumber?: string | null;
  theme?: string;
  isVerified?: boolean;
  verificationStatus?: string | null;
  hourlyRate?: number | null;
  bio?: string | null;
}

export interface UserProfile extends User {
  address?: string;
}
