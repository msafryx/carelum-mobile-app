/**
 * Pre-booking meeting requests: parent requests video call with sitter before sending a session request.
 */
import { API_ENDPOINTS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';
import { apiRequest } from './api-base.service';

export interface MeetingRequest {
  id: string;
  parent_id: string;
  sitter_id: string;
  preferred_time?: string;
  scheduled_time?: string;
  meeting_link?: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  parent_display_name?: string;
  parent_photo_url?: string;
  sitter_display_name?: string;
  sitter_photo_url?: string;
}

export async function createMeetingRequest(
  sitterId: string,
  preferredTime?: string
): Promise<ServiceResult<MeetingRequest>> {
  return apiRequest<MeetingRequest>(API_ENDPOINTS.MEETING_REQUESTS, {
    method: 'POST',
    body: JSON.stringify({ sitter_id: sitterId, preferred_time: preferredTime || null }),
  });
}

export async function listMeetingRequests(role: 'parent' | 'sitter'): Promise<ServiceResult<MeetingRequest[]>> {
  return apiRequest<MeetingRequest[]>(`${API_ENDPOINTS.MEETING_REQUESTS}?role=${role}`, { method: 'GET' });
}

export async function getMeetingRequest(id: string): Promise<ServiceResult<MeetingRequest>> {
  return apiRequest<MeetingRequest>(API_ENDPOINTS.MEETING_REQUEST_BY_ID(id), { method: 'GET' });
}

export async function acceptMeetingRequest(
  id: string,
  scheduledTime?: string
): Promise<ServiceResult<MeetingRequest>> {
  return apiRequest<MeetingRequest>(API_ENDPOINTS.MEETING_REQUEST_ACCEPT(id), {
    method: 'PATCH',
    body: JSON.stringify({ scheduled_time: scheduledTime || null }),
  });
}

export async function declineMeetingRequest(id: string): Promise<ServiceResult<MeetingRequest>> {
  return apiRequest<MeetingRequest>(API_ENDPOINTS.MEETING_REQUEST_DECLINE(id), { method: 'PATCH' });
}

export async function completeMeetingRequest(id: string): Promise<ServiceResult<{ success: boolean; status: string }>> {
  return apiRequest<{ success: boolean; status: string }>(API_ENDPOINTS.MEETING_REQUEST_COMPLETE(id), {
    method: 'POST',
  });
}
