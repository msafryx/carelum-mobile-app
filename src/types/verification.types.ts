import { VerificationStatus } from '@/src/config/constants';

export interface VerificationDocuments {
  nicUrl: string;
  passportUrl?: string;
  certificates?: string[];
}

export interface VerificationRequest {
  id: string;
  babysitterId: string;
  status: VerificationStatus;
  documents: VerificationDocuments;
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface BabysitterProfile {
  userId: string;
  verificationStatus: VerificationStatus;
  rejectionReason?: string;
  documents: VerificationDocuments;
  bio?: string;
  hourlyRate?: number;
  availability?: boolean;
}
