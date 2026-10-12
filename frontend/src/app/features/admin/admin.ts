import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, errorMessage } from '../../core/api.service';
import { AdminUser } from '../../core/models';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { AddLogin } from './add-login/add-login';

/** How often the list (and the green "online" dots) refreshes while the page is open. */
const REFRESH_MS = 20_000;

/** Admin: everyone who can sign in, add a friend, reset a password. No money data here. */
@Component({
  selector: 'app-admin',
  imports: [DatePipe, ReactiveFormsModule, Avatar, AddLogin],
  templateUrl: './admin.html',
  styleUrl: './admin.scss',
})
export class AdminPage {
  private api = inject(Api);

  protected readonly users = signal<AdminUser[]>([]);
  /** Most logins allowed in total (MAX_USERS on the server). */
  protected readonly maxUsers = signal(0);
  protected readonly full = computed(() => this.maxUsers() > 0 && this.users().length >= this.maxUsers());
  protected readonly loadError = signal('');
  /** The login whose password is being reset, and the form for it. */
  protected readonly resetting = signal<string | null>(null);
  protected readonly resetForm = new FormGroup({
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });
  protected readonly resetError = signal('');
  protected readonly resetDone = signal('');

  constructor() {
    this.load();
    const timer = setInterval(() => this.load(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected async load() {
    try {
      const { users, maxUsers } = await this.api.adminUsers();
      this.users.set(users);
      this.maxUsers.set(maxUsers);
      this.loadError.set('');
    } catch (e) {
      this.loadError.set(errorMessage(e));
    }
  }

  protected startReset(u: AdminUser) {
    this.resetting.set(u.id);
    this.resetForm.reset();
    this.resetError.set('');
    this.resetDone.set('');
  }

  protected async saveReset(u: AdminUser) {
    const password = this.resetForm.controls.password.value;
    if (password.length < 8) return this.resetError.set('The password needs at least 8 characters.');
    try {
      await this.api.adminResetPassword(u.id, password);
      this.resetDone.set(`New password for ${u.email || u.phone}: ${password}`);
      this.resetting.set(null);
    } catch (e) {
      this.resetError.set(errorMessage(e));
    }
  }
}
