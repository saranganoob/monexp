import { Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorMessage } from '../../../core/api.service';
import { Busy } from '../../../shared/directives/busy';

/** Change the sign-in password (needs the current one). */
@Component({
  selector: 'app-password-card',
  imports: [ReactiveFormsModule, Busy],
  templateUrl: './password-card.html',
  styleUrl: './password-card.scss',
})
export class PasswordCard {
  private api = inject(Api);

  protected readonly form = inject(NonNullableFormBuilder).group({
    current: ['', Validators.required],
    next: ['', [Validators.required, Validators.minLength(8)]],
    again: ['', Validators.required],
  });
  protected readonly error = signal('');
  protected readonly status = signal('');
  protected readonly busy = signal(false);

  constructor() {
    this.form.valueChanges.subscribe(() => { this.error.set(''); this.status.set(''); });
  }

  async save() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    if (!v.current) return this.error.set('Enter your current password.');
    if (v.next.length < 8) return this.error.set('The new password needs at least 8 characters.');
    if (v.next !== v.again) return this.error.set('The two new passwords don’t match.');
    this.busy.set(true);
    try {
      await this.api.changePassword(v.current, v.next);
      this.form.reset({ current: '', next: '', again: '' }, { emitEvent: false });
      this.status.set('Password changed');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
