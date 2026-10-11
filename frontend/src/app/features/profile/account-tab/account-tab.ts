import { Component, effect, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../../../core/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { firstError, optionalEmail, optionalMobile } from '../../../core/forms/validators';

/** Email and mobile used to sign in. */
@Component({
  selector: 'app-account-tab',
  imports: [ReactiveFormsModule],
  templateUrl: './account-tab.html',
  styleUrl: './account-tab.scss',
})
export class AccountTab {
  private api = inject(Api);
  private auth = inject(AuthService);
  private router = inject(Router);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', optionalEmail],
    phone: ['', optionalMobile],
  });
  protected readonly error = signal('');
  protected readonly status = signal('');

  constructor() {
    effect(() => {
      const a = this.auth.account();
      this.form.setValue({ email: a?.email ?? '', phone: a?.phone ?? '' }, { emitEvent: false });
    });
    this.form.valueChanges.subscribe(() => { this.error.set(''); this.status.set(''); });
  }

  async save() {
    this.form.markAllAsTouched();
    this.error.set(firstError(this.form, {
      email: { email: 'Enter a valid email address.' },
      phone: { mobile: 'Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.' },
    }));
    if (this.error()) return;
    const v = this.form.getRawValue();
    try {
      this.auth.account.set(await this.api.updateMe({ email: v.email.trim(), phone: v.phone.replace(/\D/g, '') }));
      this.status.set('Saved');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async signOut() {
    await this.auth.logout();
    this.router.navigateByUrl('/login');
  }
}
