/**
 * Date, currency, and other formatting utilities
 */

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTimeReadable(date: Date | string | null | undefined): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCurrency(amount: number, currency: string = 'LKR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  }

  return formatDate(d);
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Calculate age from date of birth
 * @param dateOfBirth - Date of birth
 * @returns Age in years (0 if invalid date)
 */
export function calculateAge(dateOfBirth: Date | string | null | undefined): number {
  if (!dateOfBirth) return 0;
  
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (isNaN(dob.getTime())) return 0;
  
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  // If birthday hasn't occurred this year yet, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return Math.max(0, age); // Ensure age is not negative
}

/**
 * Calculate age with months from date of birth
 * @param dateOfBirth - Date of birth
 * @returns Object with years and months, or null if invalid
 */
export function calculateAgeWithMonths(
  dateOfBirth: Date | string | null | undefined
): { years: number; months: number; totalMonths: number } | null {
  if (!dateOfBirth) return null;
  
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  
  // Adjust if birthday hasn't occurred this month yet
  if (today.getDate() < dob.getDate()) {
    months--;
  }
  
  // Adjust if months is negative
  if (months < 0) {
    months += 12;
    years--;
  }
  
  const totalMonths = years * 12 + months;
  
  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    totalMonths: Math.max(0, totalMonths),
  };
}

/**
 * Calculate age with months and days from date of birth
 * @param dateOfBirth - Date of birth
 * @returns Object with years, months, and days, or null if invalid
 */
export function calculateAgeWithMonthsAndDays(
  dateOfBirth: Date | string | null | undefined
): { years: number; months: number; days: number } | null {
  if (!dateOfBirth) return null;
  
  const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
  if (isNaN(dob.getTime())) return null;
  
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();
  let days = today.getDate() - dob.getDate();
  
  // Adjust if day hasn't occurred this month yet
  if (days < 0) {
    months--;
    // Get days in previous month
    const lastDayOfPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += lastDayOfPrevMonth;
  }
  
  // Adjust if months is negative
  if (months < 0) {
    months += 12;
    years--;
  }
  
  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

/**
 * Format age with months for display
 * @param dateOfBirth - Date of birth
 * @returns Formatted age string (e.g., "1 year 3 months", "15 months", "2 years")
 */
export function formatAgeWithMonths(
  dateOfBirth: Date | string | null | undefined
): string {
  const ageData = calculateAgeWithMonths(dateOfBirth);
  
  if (!ageData) return 'Age not available';
  
  const { years, months, totalMonths } = ageData;
  
  // If less than 1 year, show only months
  if (years === 0) {
    if (totalMonths === 0) {
      return 'Newborn';
    }
    return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  }
  
  // If exactly 1 year with no extra months
  if (years === 1 && months === 0) {
    return '1 year';
  }
  
  // If 1 year with months
  if (years === 1) {
    return `1 year ${months} month${months !== 1 ? 's' : ''}`;
  }
  
  // Multiple years
  if (months === 0) {
    return `${years} years`;
  }
  
  return `${years} years ${months} month${months !== 1 ? 's' : ''}`;
}

/**
 * Format age with months and days for display
 * For children < 1 year: shows months and days (e.g., "5 months 12 days")
 * For children >= 1 year: shows years, months, and days (e.g., "2 years 3 months 15 days")
 * @param dateOfBirth - Date of birth
 * @returns Formatted age string
 */
export function formatAgeWithMonthsAndDays(
  dateOfBirth: Date | string | null | undefined
): string {
  const ageData = calculateAgeWithMonthsAndDays(dateOfBirth);
  
  if (!ageData) return 'Age not available';
  
  const { years, months, days } = ageData;
  
  // If less than 1 year, show months and days
  if (years === 0) {
    if (months === 0 && days === 0) {
      return 'Newborn';
    }
    if (months === 0) {
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (days === 0) {
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
    return `${months} month${months !== 1 ? 's' : ''} ${days} day${days !== 1 ? 's' : ''}`;
  }
  
  // For 1 year or older, show years, months, and days
  const parts: string[] = [];
  
  // Add years
  if (years === 1) {
    parts.push('1 year');
  } else {
    parts.push(`${years} years`);
  }
  
  // Add months
  if (months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  }
  
  // Add days
  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? 's' : ''}`);
  }
  
  return parts.join(' ');
}
