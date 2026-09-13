import moment from 'moment';
import 'moment-hijri';
import { logger } from '../../../shared/logger';

/**
 * Hijri Date Conversion Service
 * Handles conversion between Gregorian and Hijri calendars
 * Uses moment-hijri library for accurate conversions
 */

export interface HijriDate {
  day: number;
  month: number;
  year: number;
}

export interface GregorianDate {
  day: number;
  month: number;
  year: number;
}

export class HijriDateService {
  /**
   * Convert Gregorian date to Hijri date
   * Uses moment-hijri library for accurate conversion
   */
  gregorianToHijri(date: Date): HijriDate {
    try {
      const hijriMoment = moment(date).format('iYYYY/iM/iD');
      const parts = hijriMoment.split('/');
      
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
      };
    } catch (error) {
      logger.error({ error, date }, 'Error converting Gregorian to Hijri');
      // Fallback to approximation if library fails
      return {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear() - 579,
      };
    }
  }

  /**
   * Convert Hijri date to Gregorian date
   */
  hijriToGregorian(hijriDate: HijriDate): Date {
    try {
      const hijriMoment = moment(
        `${hijriDate.year}/${hijriDate.month}/${hijriDate.day}`,
        'iYYYY/iM/iD'
      );
      return hijriMoment.toDate();
    } catch (error) {
      logger.error({ error, hijriDate }, 'Error converting Hijri to Gregorian');
      // Fallback to current date if conversion fails
      return new Date();
    }
  }

  /**
   * Format date string (DD-MM-YYYY)
   */
  formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }

  /**
   * Parse date string (DD-MM-YYYY)
   */
  parseDate(dateString: string): Date | null {
    const parts = dateString.split('-');
    if (parts.length !== 3) return null;
    
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);
    
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    
    return new Date(year, month, day);
  }
}

export const hijriDateService = new HijriDateService();
