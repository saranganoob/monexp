import { Component, inject } from '@angular/core';
import { Store } from '../core/store';

@Component({
  selector: 'app-undo-toast',
  template: `
    @if (store.toast(); as t) {
      <div role="status" class="toast" [class.error]="t.error">
        <span>{{ t.message }}</span>
        @if (t.undoToken) {
          <button class="btn btn-sm undo" (click)="store.undo()">Undo</button>
        } @else {
          <button class="btn btn-sm undo" (click)="store.toast.set(null)" aria-label="Dismiss">✕</button>
        }
      </div>
    }
  `,
  styles: `
    .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 45; background: #111827; color: #fff; border-radius: 12px; padding: 8px 8px 8px 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px; box-shadow: 0 10px 30px rgba(17,24,39,0.25); font-size: 14px; max-width: calc(100% - 32px); }
    .toast.error { background: #A3201A; }
    .undo { background: #1F2937; border-color: #374151; color: #fff; }
    .error .undo { background: #8A1B16; border-color: #C2453F; }
    @media (max-width: 860px) { .toast { width: calc(100% - 32px); } }
  `,
})
export class UndoToast {
  protected store = inject(Store);
}
