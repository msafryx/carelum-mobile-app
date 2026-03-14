import { supabase, isSupabaseConfigured } from '@/src/config/supabase';
import { ServiceResult } from '@/src/types/error.types';

export interface CreateReviewInput {
  sessionId: string;
  sitterId: string;
  rating: number;
  comment?: string;
}

export async function createReview(input: CreateReviewInput): Promise<ServiceResult<null>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        success: false,
        error: {
          code: 'SUPABASE_NOT_CONFIGURED',
          message: 'Supabase is not configured.',
          details: null,
        },
      };
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return {
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'You must be signed in to submit a review.',
          details: userError?.message ?? null,
        },
      };
    }

    const reviewerId = userData.user.id;

    const { error: insertError } = await supabase.from('reviews').insert({
      session_id: input.sessionId,
      reviewer_id: reviewerId,
      reviewee_id: input.sitterId,
      rating: input.rating,
      comment: input.comment?.trim() || null,
    });

    if (insertError) {
      console.error('Failed to create review:', insertError);
      return {
        success: false,
        error: {
          code: 'CREATE_REVIEW_FAILED',
          message: 'Failed to submit review. Please try again.',
          details: insertError.message,
        },
      };
    }

    return { success: true, data: null };
  } catch (error: any) {
    console.error('Unexpected error creating review:', error);
    return {
      success: false,
      error: {
        code: 'UNEXPECTED_ERROR',
        message: 'Unexpected error while submitting review.',
        details: error?.message ?? null,
      },
    };
  }
}

