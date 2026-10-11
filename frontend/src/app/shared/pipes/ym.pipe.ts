import { Pipe, PipeTransform } from '@angular/core';
import { dayMonth, ymLabel, ymShort } from '../../core/utils/format';

/**
 * Month and date labels.
 *   {{ '2026-10' | ym }}          → October 2026
 *   {{ '2026-10' | ym: 'short' }} → Oct 2026
 *   {{ '2026-10-11' | ym: 'day' }} → 11 Oct
 */
@Pipe({ name: 'ym' })
export class YmPipe implements PipeTransform {
  transform(value: string | null | undefined, format: 'long' | 'short' | 'day' = 'long'): string {
    if (!value) return '';
    if (format === 'day') return dayMonth(value);
    return format === 'short' ? ymShort(value) : ymLabel(value);
  }
}
