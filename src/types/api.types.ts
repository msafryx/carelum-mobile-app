export interface PredictResponse {
  label: 'crying' | 'normal';
  score: number;
}

export interface BotUpdateRequest {
  parentId: string;
  instructions: string;
  schedule?: string;
  allergies?: string[];
  emergencyContacts?: EmergencyContact[];
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface BotAskRequest {
  sessionId: string;
  question: string;
}

export interface BotAskResponse {
  answer: string;
  sources?: string[];
}
