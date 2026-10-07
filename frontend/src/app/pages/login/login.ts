import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from '../../core/auth';
import { errorMessage } from '../../core/api.service';
import { checked, val } from '../../core/format';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginPage {
  private auth = inject(Auth);
  private router = inject(Router);
  protected val = val;
  protected checked = checked;

  protected id = signal('');
  protected pw = signal('');
  protected showPw = signal(false);
  protected remember = signal(true);
  protected err = signal('');
  protected busy = signal(false);
  protected showHelp = signal(false);

  async submit() {
    if (this.busy()) return;
    const id = this.id().trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id);
    const digits = id.replace(/\D/g, '');
    const isPhone = !/[a-z]/i.test(id) && digits.length >= 10 && /^[6-9]\d{9}$/.test(digits.slice(-10));
    if (!id) return this.err.set('Enter your email or mobile number.');
    if (!isEmail && !isPhone) return this.err.set('Enter a valid email or a 10-digit mobile number.');
    if (!this.pw()) return this.err.set('Enter your password.');

    this.busy.set(true);
    this.err.set('');
    try {
      await this.auth.login(id, this.pw(), this.remember());
      this.router.navigateByUrl('/');
    } catch (e) {
      this.err.set(errorMessage(e));
    } finally {
      this.busy.set(false);
      this.pw.set('');
    }
  }
}
