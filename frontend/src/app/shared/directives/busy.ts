import { Directive, computed, inject, input } from '@angular/core';
import { LoadingService } from '../../core/loading.service';

/**
 * Loading state for a button (or a tick box): `[appBusy]="'bill:' + id"` follows an action key
 * from AppStore.run(…, { key }); `[appBusy]="busy()"` follows a boolean.
 * Disabled at once while pending (no double submit); spinner only if it takes over 300ms.
 */
@Directive({
  selector: '[appBusy]',
  host: {
    '[class.is-pending]': 'pending()',
    '[class.is-busy]': 'slow()',
    '[attr.aria-busy]': 'pending() || null',
    '[attr.aria-disabled]': 'pending() || null',
  },
})
export class Busy {
  private loading = inject(LoadingService);
  /** Action key, or true/false. */
  readonly appBusy = input<string | boolean | null | undefined>(false);

  protected readonly pending = computed(() => {
    const v = this.appBusy();
    return typeof v === 'string' ? this.loading.isPending(v) : !!v;
  });
  protected readonly slow = computed(() => {
    const v = this.appBusy();
    return typeof v === 'string' ? this.loading.isSlow(v) : !!v;
  });
}
