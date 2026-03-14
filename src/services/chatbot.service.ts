/**
 * Child Care Assistant Service (instruction-based).
 * Uses POST /api/child-assistant; logs to assistant_query_logs for admin.
 */
import { API_ENDPOINTS } from '@/src/config/constants';
import { ServiceResult } from '@/src/types/error.types';
import { handleUnexpectedError } from '@/src/utils/errorHandler';
import { apiRequest } from './api-base.service';

/**
 * Ask the child care assistant (instruction-based).
 * Uses child profile + child_instructions; logs query for admin.
 */
export async function askChildAssistant(
  sessionId: string,
  childId: string,
  question: string
): Promise<ServiceResult<{ answer: string }>> {
  try {
    const result = await apiRequest<{ answer: string }>(API_ENDPOINTS.CHILD_ASSISTANT, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        child_id: childId,
        question: question.trim(),
      }),
    });
    return result;
  } catch (error: any) {
    return {
      success: false,
      error: handleUnexpectedError(error),
    };
  }
}
