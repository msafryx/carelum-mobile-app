/**
 * Session Search Utilities
 * Helper functions for displaying search status and duration
 */
import { Session } from '@/src/types/session.types';
import { differenceInMinutes, differenceInSeconds } from 'date-fns';

/**
 * Format search duration in a human-readable format
 */
export function formatSearchDuration(createdAt: Date): string {
  const now = new Date();
  const created = new Date(createdAt);
  
  // Ensure we have valid dates
  if (isNaN(now.getTime()) || isNaN(created.getTime())) {
    console.warn('⚠️ formatSearchDuration: Invalid dates', { now, created, createdAt });
    return '0m';
  }
  
  // Calculate difference in milliseconds for precision
  const diffMs = now.getTime() - created.getTime();
  
  // Handle negative differences (shouldn't happen, but just in case)
  if (diffMs < 0) {
    return '0m';
  }
  
  const totalSeconds = Math.floor(diffMs / 1000);
  
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }
  
  // Calculate hours and remaining minutes from total seconds
  // This is the key calculation - we need to be precise
  const hours = Math.floor(totalSeconds / 3600);
  const remainingSeconds = totalSeconds % 3600; // Seconds remaining after removing full hours
  const remainingMinutes = Math.floor(remainingSeconds / 60); // Convert remaining seconds to minutes
  
  // Always log for debugging
  console.log('🔍 formatSearchDuration calculation:', {
    totalSeconds,
    hours,
    remainingSeconds,
    remainingMinutes,
    createdAt: created.toISOString(),
    now: now.toISOString(),
    willShow: remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  });
  
  if (hours < 24) {
    // Always show minutes if there are any remaining
    if (remainingMinutes > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    // Only show hours if it's exactly on the hour (no minutes)
    return `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0 && remainingMinutes > 0) {
    return `${days}d ${remainingHours}h ${remainingMinutes}m`;
  } else if (remainingHours > 0) {
    return `${days}d ${remainingHours}h`;
  } else if (remainingMinutes > 0) {
    return `${days}d ${remainingMinutes}m`;
  }
  return `${days}d`;
}

/**
 * Calculate time difference between two dates
 */
export function calculateTimeDifference(startDate: Date, endDate: Date): string {
  const seconds = differenceInSeconds(endDate, startDate);
  
  if (seconds < 60) {
    return `${seconds} seconds`;
  }
  
  const minutes = differenceInMinutes(endDate, startDate);
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    if (remainingMinutes > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }
  return `${days} day${days !== 1 ? 's' : ''}`;
}

/**
 * Get searching message based on duration
 */
export function getSearchingMessage(session: Session): string {
  if (!session.createdAt) {
    return 'Searching for sitters...';
  }
  
  const now = new Date();
  const created = new Date(session.createdAt);
  const minutes = differenceInMinutes(now, created);
  
  if (minutes < 1) {
    return 'Searching for sitters...';
  } else if (minutes < 3) {
    return 'Finding available sitters...';
  } else if (minutes < 5) {
    return 'Still searching...';
  } else if (minutes < 10) {
    return 'Taking a bit longer than usual...';
  } else {
    return 'Searching may take longer. Please wait...';
  }
}

/**
 * Calculate how long it took to get accepted (from created to accepted)
 */
export function getAcceptedDuration(session: Session): string | null {
  if (session.status !== 'accepted' && !['active', 'completed'].includes(session.status)) {
    return null;
  }
  
  if (!session.createdAt) {
    return null;
  }
  
  // Use updatedAt as the accepted time (when status changed to accepted)
  const acceptedAt = session.updatedAt || new Date();
  return calculateTimeDifference(session.createdAt, acceptedAt);
}

/**
 * Format expected duration in a practical way (like Uber/PickMe)
 * Shows days and hours in a user-friendly format
 */
export function formatExpectedDuration(session: Session): string {
  // If time slots exist, calculate from time slots
  if (session.timeSlots && session.timeSlots.length > 0) {
    const totalHours = session.timeSlots.reduce((sum, slot) => sum + slot.hours, 0);
    return formatHoursToDuration(totalHours);
  }
  
  // Otherwise, calculate from start and end time
  if (session.startTime && session.endTime) {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const diffMs = end.getTime() - start.getTime();
    const totalHours = diffMs / (1000 * 60 * 60);
    return formatHoursToDuration(totalHours);
  }
  
  return 'N/A';
}

/**
 * Format hours to a human-readable duration (e.g., "2 days 5 hours" or "53 hours")
 */
function formatHoursToDuration(totalHours: number): string {
  if (totalHours < 1) {
    const minutes = Math.round(totalHours * 60);
    return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  }
  
  if (totalHours < 24) {
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    if (minutes > 0) {
      return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  
  const days = Math.floor(totalHours / 24);
  const remainingHours = Math.round(totalHours % 24);
  
  if (remainingHours > 0) {
    return `${days} day${days !== 1 ? 's' : ''} ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}`;
  }
  return `${days} day${days !== 1 ? 's' : ''}`;
}
