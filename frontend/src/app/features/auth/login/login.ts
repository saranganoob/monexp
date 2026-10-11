import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Api, errorMessage } from '../../../core/api.service';
import { emailOrMobile, firstError } from '../../../core/forms/validators';
import { Icon } from '../../../shared/ui/icon/icon';

type Mode = 'pw' | 'otp';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Icon],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage implements OnInit {
  private auth = inject(AuthService);
  private api = inject(Api);
  private router = inject(Router);
  private fb = inject(NonNullableFormBuilder);

  protected readonly features = [
    'Tick bills paid and watch your balance update',
    'Track friends’ EMIs on your cards until they close',
    'Ask the assistant about your spends in plain words',
  ];

  protected readonly form = this.fb.group({
    identifier: ['', emailOrMobile],
    password: [''],
    otp: [''],
    remember: [true],
  });

  protected readonly mode = signal<Mode>('pw');
  protected readonly otpEnabled = signal(false);
  protected readonly otpSent = signal(false);
  protected readonly sentTo = signal('');
  protected readonly showPw = signal(false);
  protected readonly showHelp = signal(false);
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly busy = signal(false);

  constructor() {
    this.form.valueChanges.subscribe(() => this.error.set(''));
    // A different email/mobile needs a new OTP.
    this.form.controls.identifier.valueChanges.subscribe(() => {
      if (this.otpSent()) { this.otpSent.set(false); this.info.set(''); this.form.controls.otp.setValue(''); }
    });
  }

  async ngOnInit() {
    try { this.otpEnabled.set((await this.api.otpStatus()).enabled); } catch { this.otpEnabled.set(false); }
  }

  setMode(m: Mode) {
    this.mode.set(m);
    this.otpSent.set(false);
    this.error.set('');
    this.info.set('');
    this.form.controls.otp.setValue('');
  }

  submitLabel() {
    if (this.mode() === 'pw') return this.busy() ? 'Signing in…' : 'Sign in';
    if (!this.otpSent()) return this.busy() ? 'Sending…' : 'Send OTP';
    return this.busy() ? 'Checking…' : 'Verify & sign in';
  }

  submit() {
    if (this.busy()) return;
    if (this.mode() === 'pw') return this.signInWithPassword();
    return this.otpSent() ? this.verifyOtp() : this.sendOtp();
  }

  /** The email/mobile field, or null after showing why it's wrong. */
  private identifier(): string | null {
    this.form.controls.identifier.markAsTouched();
    const msg = firstError(this.form, { identifier: { required: 'Enter your email or mobile number.', emailOrMobile: 'Enter a valid email or a 10-digit mobile number.' } });
    if (msg) { this.error.set(msg); return null; }
    return this.form.controls.identifier.value.trim();
  }

  private async signInWithPassword() {
    const id = this.identifier();
    if (!id) return;
    const { password, remember } = this.form.getRawValue();
    if (!password) return this.error.set('Enter your password.');
    await this.attempt(() => this.auth.login(id, password, remember));
    this.form.controls.password.setValue('');
  }

  async sendOtp() {
    const id = this.identifier();
    if (!id) return;
    this.busy.set(true);
    this.info.set('');
    try {
      const res = await this.api.requestOtp(id);
      this.sentTo.set(res.sentTo);
      this.otpSent.set(true);
      this.form.controls.otp.setValue('');
      this.info.set('OTP sent. It’s valid for 10 minutes.');
      setTimeout(() => document.getElementById('lOtp')?.focus());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async verifyOtp() {
    const id = this.identifier();
    if (!id) return;
    const { otp, remember } = this.form.getRawValue();
    if (!/^\d{6}$/.test(otp)) return this.error.set('Enter the 6-digit OTP.');
    this.info.set('');
    await this.attempt(() => this.auth.loginWithOtp(id, otp, remember));
  }

  private async attempt(signIn: () => Promise<void>) {
    this.busy.set(true);
    try {
      await signIn();
      this.router.navigateByUrl('/');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  onlyDigits() {
    const c = this.form.controls.otp;
    const clean = c.value.replace(/\D/g, '').slice(0, 6);
    if (clean !== c.value) c.setValue(clean, { emitEvent: false });
  }
}
