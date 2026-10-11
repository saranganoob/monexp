import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { Api, errorMessage } from '../../core/api.service';
import { checked, val } from '../../core/format';

type Mode = 'pw' | 'otp';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage implements OnInit {
  private auth = inject(Auth);
  private api = inject(Api);
  private router = inject(Router);
  protected val = val;
  protected checked = checked;

  protected mode = signal<Mode>('pw');
  protected otpEnabled = signal(false);
  protected id = signal('');
  protected pw = signal('');
  protected showPw = signal(false);
  protected remember = signal(true);
  protected err = signal('');
  protected info = signal('');
  protected busy = signal(false);
  protected showHelp = signal(false);

  // OTP
  protected otpSent = signal(false);
  protected sentTo = signal('');
  protected otp = signal('');

  async ngOnInit() {
    try { this.otpEnabled.set((await this.api.otpStatus()).enabled); } catch { this.otpEnabled.set(false); }
  }

  tabStyle(on: boolean) {
    return `font: inherit; font-size: 14px; font-weight: 700; min-height: 40px; border-radius: 9px; border: none; cursor: pointer; background: ${on ? '#fff' : 'transparent'}; color: ${on ? '#111827' : '#4B5563'}; box-shadow: ${on ? '0 1px 3px rgba(17,24,39,0.12)' : 'none'}`;
  }

  setMode(m: Mode) {
    this.mode.set(m);
    this.err.set(''); this.info.set(''); this.otp.set(''); this.otpSent.set(false);
  }

  /** Email or Indian mobile number – same rules as the backend. */
  private checkId(): string | null {
    const id = this.id().trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const digits = id.replace(/\D/g, '');
    const isPhone = !/[a-z]/i.test(id) && digits.length >= 10 && /^[6-9]\d{9}$/.test(digits.slice(-10));
    if (!id) { this.err.set('Enter your email or mobile number.'); return null; }
    if (!isEmail && !isPhone) { this.err.set('Enter a valid email or a 10-digit mobile number.'); return null; }
    return id;
  }

  submit() { return this.mode() === 'pw' ? this.submitPassword() : this.otpSent() ? this.verifyOtp() : this.sendOtp(); }

  private async submitPassword() {
    if (this.busy()) return;
    const id = this.checkId();
    if (!id) return;
    if (!this.pw()) return this.err.set('Enter your password.');
    await this.attempt(() => this.auth.login(id, this.pw(), this.remember()));
    this.pw.set('');
  }

  async sendOtp() {
    if (this.busy()) return;
    const id = this.checkId();
    if (!id) return;
    this.busy.set(true); this.err.set(''); this.info.set('');
    try {
      const res = await this.api.requestOtp(id);
      this.sentTo.set(res.sentTo);
      this.otpSent.set(true);
      this.otp.set('');
      this.info.set('OTP sent. It’s valid for 10 minutes.');
      setTimeout(() => document.getElementById('lOtp')?.focus());
    } catch (e) {
      this.err.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async verifyOtp() {
    if (this.busy()) return;
    const id = this.checkId();
    if (!id) return;
    if (!/^\d{6}$/.test(this.otp())) return this.err.set('Enter the 6-digit OTP.');
    this.info.set('');
    await this.attempt(() => this.auth.loginWithOtp(id, this.otp(), this.remember()));
  }

  private async attempt(signIn: () => Promise<void>) {
    this.busy.set(true);
    this.err.set('');
    try {
      await signIn();
      this.router.navigateByUrl('/');
    } catch (e) {
      this.err.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  changeId(e: Event) {
    this.id.set(val(e));
    this.err.set('');
    if (this.otpSent()) { this.otpSent.set(false); this.otp.set(''); this.info.set(''); } // new address → send again
  }

  submitLabel() {
    if (this.mode() === 'pw') return this.busy() ? 'Signing in…' : 'Sign in';
    if (!this.otpSent()) return this.busy() ? 'Sending…' : 'Send OTP';
    return this.busy() ? 'Checking…' : 'Verify & sign in';
  }
}
