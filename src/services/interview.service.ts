/**
 * Interview (parent–sitter video call) scheduling
 */
import { API_ENDPOINTS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';
import { apiRequest } from './api-base.service';

export interface ScheduleInterviewInput {
  session_id: string;
  preferred_time: string;
}

export interface ScheduleInterviewResult {
  interview_id: string;
  scheduled_time: string;
  meeting_link: string;
  status: string;
}

export interface Interview {
  id: string;
  session_id: string;
  parent_id: string;
  sitter_id: string;
  scheduled_time: string;
  meeting_link: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export async function scheduleInterview(
  sessionId: string,
  preferredTime: string
): Promise<ServiceResult<ScheduleInterviewResult>> {
  return apiRequest<ScheduleInterviewResult>(API_ENDPOINTS.INTERVIEWS_SCHEDULE, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, preferred_time: preferredTime }),
  });
}

export async function getInterviewBySession(sessionId: string): Promise<ServiceResult<Interview | null>> {
  const res = await apiRequest<Interview | null>(API_ENDPOINTS.INTERVIEWS_BY_SESSION(sessionId), {
    method: 'GET',
  });
  return res;
}

export async function getInterview(interviewId: string): Promise<ServiceResult<Interview>> {
  return apiRequest<Interview>(API_ENDPOINTS.INTERVIEW_BY_ID(interviewId), { method: 'GET' });
}

export async function completeInterview(interviewId: string): Promise<ServiceResult<{ success: boolean; status: string }>> {
  return apiRequest<{ success: boolean; status: string }>(API_ENDPOINTS.INTERVIEW_COMPLETE(interviewId), {
    method: 'POST',
  });
}
