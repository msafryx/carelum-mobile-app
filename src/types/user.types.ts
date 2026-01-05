import { UserRole, Language } from '@/src/config/constants';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  preferredLanguage: Language;
  displayName: string;
  createdAt: Date;
  profileImageUrl?: string;
}

export interface UserProfile extends User {
  phoneNumber?: string;
  address?: string;
}
