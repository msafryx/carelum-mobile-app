import { SessionStatus } from '@/src/config/constants';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  timestamp: Date;
}

export interface Session {
  id: string;
  parentId: string;
  babysitterId: string;
  status: SessionStatus;
  startTime?: Date;
  endTime?: Date;
  location?: LocationUpdate[];
  createdAt: Date;
}
