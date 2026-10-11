import { Pipe, PipeTransform } from '@angular/core';
import { inr } from '../../core/utils/format';

/** {{ 61833 | inr }} → ₹61,833 (Indian digit grouping). */
@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return inr(value);
  }
}
