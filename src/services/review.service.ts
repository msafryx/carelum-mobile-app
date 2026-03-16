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

export interface Review {
  id: string;
  session_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export async function getReviewForSession(sessionId: string): Promise<ServiceResult<Review | null>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('id, session_id, reviewer_id, reviewee_id, rating, comment, created_at')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) {
      console.error('getReviewForSession error:', error);
      return { success: false, error: { code: 'FETCH_REVIEW_FAILED', message: error.message, details: error.message } };
    }
    return { success: true, data: data as Review | null };
  } catch (e: any) {
    console.error('getReviewForSession:', e);
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to load review.', details: e?.message ?? null } };
  }
}

export interface SitterReviewRow {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
}

export async function getSitterReviews(sitterId: string, limit = 20): Promise<ServiceResult<SitterReviewRow[]>> {
  try {
    if (!isSupabaseConfigured() || !supabase) {
      return { success: false, error: { code: 'SUPABASE_NOT_CONFIGURED', message: 'Supabase is not configured.', details: null } };
    }
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, comment, created_at, reviewer_id')
      .eq('reviewee_id', sitterId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      return { success: false, error: { code: 'FETCH_REVIEWS_FAILED', message: error.message, details: error.message } };
    }
    return { success: true, data: (data ?? []) as SitterReviewRow[] };
  } catch (e: any) {
    return { success: false, error: { code: 'UNEXPECTED_ERROR', message: e?.message ?? 'Failed to load reviews.', details: e?.message ?? null } };
  }
}

