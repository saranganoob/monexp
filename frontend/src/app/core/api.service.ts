import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Account, AdminUser, Card, CardEmi, ChangeResult, Installment, MonthView, Person, PersonStats, Plan, Prefs, YearView, DailyDay, DailyMonth } from './models';

/** True when the request never got an answer (offline, server down, timed out) – worth a Retry. */
export const isConnectionError = (err: unknown) => err instanceof HttpErrorResponse && err.status === 0;

/** Turns an HTTP error into the backend's plain-English message. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return err.error?.error || 'Can’t reach the MonEXP server. Check your connection.';
    return err.error?.error || `Something went wrong (${err.status}).`;
  }
  return 'Something went wrong.';
}

/** Every call to the backend. All return promises. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private get<T>(url: string) { return firstValueFrom(this.http.get<T>(`/api${url}`)); }
  private post<T>(url: string, body: unknown = {}) { return firstValueFrom(this.http.post<T>(`/api${url}`, body)); }
  private patch<T>(url: string, body: unknown) { return firstValueFrom(this.http.patch<T>(`/api${url}`, body)); }
  private put<T>(url: string, body: unknown) { return firstValueFrom(this.http.put<T>(`/api${url}`, body)); }
  private del<T>(url: string) { return firstValueFrom(this.http.delete<T>(`/api${url}`)); }

  // sign in
  login(identifier: string, password: string, remember: boolean) { return this.post<Account>('/auth/login', { identifier, password, remember }); }
  otpStatus() { return this.get<{ enabled: boolean }>('/auth/otp'); }
  requestOtp(identifier: string) { return this.post<{ sentTo: string; demo: boolean }>('/auth/otp/request', { identifier }); }
  verifyOtp(identifier: string, otp: string, remember: boolean) { return this.post<Account>('/auth/otp/verify', { identifier, otp, remember }); }
  logout() { return this.post<{ ok: boolean }>('/auth/logout'); }
  me() { return this.get<Account>('/auth/me'); }
  updateMe(body: Partial<Account>) { return this.patch<Account>('/auth/me', body); }
  updatePrefs(prefs: Partial<Prefs>) { return this.patch<Account>('/auth/prefs', prefs); }
  changePassword(current: string, next: string) { return this.post<{ ok: boolean }>('/auth/password', { current, next }); }

  // admin (logins only)
  adminUsers() { return this.get<{ users: AdminUser[]; maxUsers: number }>('/admin/users'); }
  adminAddUser(body: { email: string; phone: string; password: string }) { return this.post<AdminUser>('/admin/users', body); }
  adminResetPassword(id: string, password: string) { return this.post<{ ok: boolean }>(`/admin/users/${id}/password`, { password }); }
  adminDeleteUser(id: string) { return this.del<{ ok: boolean }>(`/admin/users/${id}`); }
  adminSetAi(id: string, allowed: boolean) { return this.patch<AdminUser>(`/admin/users/${id}/ai`, { allowed }); }

  // months
  month(ym: string) { return this.get<MonthView>(`/months/${ym}`); }
  createMonth(ym: string, mode: 'rollover' | 'blank', carryIds: string[] = []) { return this.post<ChangeResult>(`/months/${ym}`, { mode, carryIds }); }
  setBudget(ym: string, budget: number) { return this.patch<ChangeResult>(`/months/${ym}`, { budget }); }
  setCardBill(ym: string, cardId: string, body: { total: number } | { spends: number } | { add: number }) { return this.put<ChangeResult>(`/months/${ym}/cards/${cardId}/bill`, body); }
  addCardSpend(ym: string, cardId: string, body: { name: string; amount: number; date: string }) { return this.post<ChangeResult>(`/months/${ym}/cards/${cardId}/spends`, body); }
  deleteCardSpend(id: string) { return this.del<ChangeResult>(`/card-spends/${id}`); }
  setEmiMonth(ym: string, emiId: string, body: { amount?: number | null; received?: 'pending' | 'done'; paid?: 'paid' | 'unpaid' }) { return this.patch<ChangeResult>(`/months/${ym}/emis/${emiId}`, body); }

  // bills
  addBill(ym: string, body: { name: string; category: string; amount: number; status: string; dueDay?: number | null }) { return this.post<ChangeResult>(`/months/${ym}/bills`, body); }
  updateBill(id: string, body: Record<string, unknown>) { return this.patch<ChangeResult>(`/bills/${id}`, body); }
  deleteBill(id: string) { return this.del<ChangeResult>(`/bills/${id}`); }

  // people entries
  addEntry(ym: string, body: { direction: 'in' | 'out'; amount: number; personId?: string; newPersonName?: string; reason?: string; name?: string }) {
    return this.post<ChangeResult>(`/months/${ym}/people-entries`, body);
  }
  updateEntry(id: string, body: { name?: string; amount?: number; status?: 'pending' | 'done' }) { return this.patch<ChangeResult>(`/people-entries/${id}`, body); }
  deleteEntry(id: string) { return this.del<ChangeResult>(`/people-entries/${id}`); }
  /** Part of the money came in / was paid back; settles the entry once it's all there. */
  /** Bought for a friend on my card: a one-time purchase they owe, or a friend's EMI (see backend routes/friendPurchases.js). */
  addFriendPurchase(body: Record<string, unknown>) { return this.post<ChangeResult>('/friend-purchases', body); }
  addEntryPart(id: string, body: { amount: number; date?: string }) { return this.post<ChangeResult>(`/people-entries/${id}/parts`, body); }
  deleteEntryPart(id: string, partId: string) { return this.del<ChangeResult>(`/people-entries/${id}/parts/${partId}`); }

  // sudden spends
  addSudden(ym: string, body: { name: string; amount: number; mode: string; date: string }) { return this.post<ChangeResult>(`/months/${ym}/sudden`, body); }
  deleteSudden(id: string) { return this.del<ChangeResult>(`/sudden/${id}`); }

  // cards, EMIs, people
  cards() { return this.get<Card[]>('/cards'); }
  addCard(body: { name: string; last4: string; network: string; addToYm?: string }) { return this.post<ChangeResult>('/cards', body); }
  updateCard(id: string, body: { name?: string; last4?: string; network?: string; closed?: boolean }) { return this.patch<ChangeResult>(`/cards/${id}`, body); }
  deleteCard(id: string) { return this.del<ChangeResult>(`/cards/${id}`); }

  emis() { return this.get<CardEmi[]>('/emis'); }
  addEmi(body: Record<string, unknown>) { return this.post<ChangeResult>('/emis', body); }
  updateEmi(id: string, body: Record<string, unknown>) { return this.patch<ChangeResult>(`/emis/${id}`, body); }
  deleteEmi(id: string) { return this.del<ChangeResult>(`/emis/${id}`); }

  plans() { return this.get<Plan[]>('/plans'); }
  addPlan(body: Record<string, unknown>) { return this.post<ChangeResult>('/plans', body); }
  updatePlan(id: string, body: Record<string, unknown>) { return this.patch<ChangeResult>(`/plans/${id}`, body); }
  deletePlan(id: string, at: string) { return this.del<ChangeResult>(`/plans/${id}?at=${at}`); }

  people(at: string) { return this.get<PersonStats[]>(`/people?at=${at}`); }
  addPerson(body: Partial<Person>) { return this.post<ChangeResult>('/people', body); }
  updatePerson(id: string, body: Partial<Person>) { return this.patch<ChangeResult>(`/people/${id}`, body); }
  deletePerson(id: string) { return this.del<ChangeResult>(`/people/${id}`); }

  // reports
  installments(at: string) { return this.get<Installment[]>(`/installments?at=${at}`); }
  year(year: number) { return this.get<YearView>(`/years/${year}`); }
  dailyMonth(ym: string) { return this.get<DailyMonth>(`/daily?ym=${ym}`); }
  saveDaily(date: string, body: Record<string, unknown>) { return this.put<DailyDay>(`/daily/${date}`, body); }
  undo(token: string) { return this.post<{ message: string }>(`/undo/${token}`); }
}
