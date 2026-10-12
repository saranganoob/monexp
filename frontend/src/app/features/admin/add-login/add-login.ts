import { Component, DOCUMENT, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorMessage } from '../../../core/api.service';
import { firstError, optionalEmail, optionalMobile } from '../../../core/forms/validators';
import { AdminUser } from '../../../core/models';

/** "Add a friend": email and/or mobile + a temporary password they change after signing in. */
@Component({
  selector: 'app-add-login',
  imports: [ReactiveFormsModule],
  templateUrl: './add-login.html',
  styleUrl: './add-login.scss',
})
export class AddLogin {
  private api = inject(Api);
  /** The login limit is reached – adding is switched off. */
  readonly full = input(false);
  readonly maxUsers = input(0);
  readonly added = output<AdminUser>();
  /** This site's address, to send to the friend. */
  protected readonly siteUrl = inject(DOCUMENT).location.origin;

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', optionalEmail],
    phone: ['', optionalMobile],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  protected readonly error = signal('');
  /** What to send the friend after a successful add. */
  protected readonly share = signal<{ login: string; password: string } | null>(null);
  protected readonly busy = signal(false);

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(''));
    effect(() => (this.full() ? this.form.disable({ emitEvent: false }) : this.form.enable({ emitEvent: false })));
  }

  async add() {
    this.form.markAllAsTouched();
    const v = this.form.getRawValue();
    const phone = v.phone.replace(/\D/g, '').slice(-10);
    this.error.set(firstError(this.form, {
      email: { email: 'Enter a valid email address.' },
      phone: { mobile: 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.' },
      password: { required: 'Set a temporary password.', minlength: 'The password needs at least 8 characters.' },
    }));
    if (!this.error() && !v.email.trim() && !phone) this.error.set('Give an email or a mobile number to sign in with.');
    if (this.error()) return;
    this.busy.set(true);
    try {
      const user = await this.api.adminAddUser({ email: v.email.trim(), phone, password: v.password });
      this.share.set({ login: user.email || user.phone, password: v.password });
      this.form.reset({ email: '', phone: '', password: '' }, { emitEvent: false });
      this.added.emit(user);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
