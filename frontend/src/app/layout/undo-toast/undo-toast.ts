import { Component, inject } from '@angular/core';
import { AppStore } from '../../core/app-store';

/** "Netflix marked paid · Undo" at the bottom of the screen. */
@Component({
  selector: 'app-undo-toast',
  templateUrl: './undo-toast.html',
  styleUrl: './undo-toast.scss',
})
export class UndoToast {
  protected store = inject(AppStore);
}
