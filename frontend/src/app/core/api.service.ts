import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  Account, Card, CardEmi, ChangeResult, Installment, MonthView, Person, PersonStats, YearView,
} from './models';

/** Turns an HTTP error into the backend's plain-English message. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'Can’t reach the MonEXP server. Is the backend running?';
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
  logout() { return this.post<{ ok: boolean }>('/auth/logout'); }
  me() { return this.get<Account>('/auth/me'); }
  updateMe(body: Partial<Account>) { return this.patch<Account>('/auth/me', body); }

  // months
  month(ym: string) { return this.get<MonthView>(`/months/${ym}`); }
  createMonth(ym: string, mode: 'rollover' | 'blank', carryIds: string[] = []) { return this.post<ChangeResult>(`/months/${ym}`, { mode, carryIds }); }
  setBudget(ym: string, budget: number) { return this.patch<ChangeResult>(`/months/${ym}`, { budget }); }
  setCardBill(ym: string, cardId: string, body: { total: number } | { spends: number }) { return this.put<ChangeResult>(`/months/${ym}/cards/${cardId}/bill`, body); }
  setEmiMonth(ym: string, emiId: string, body: { amount?: number | null; received?: 'pending' | 'done' }) { return this.patch<ChangeResult>(`/months/${ym}/emis/${emiId}`, body); }

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

  people(at: string) { return this.get<PersonStats[]>(`/people?at=${at}`); }
  addPerson(body: Partial<Person>) { return this.post<ChangeResult>('/people', body); }
  updatePerson(id: string, body: Partial<Person>) { return this.patch<ChangeResult>(`/people/${id}`, body); }
  deletePerson(id: string) { return this.del<ChangeResult>(`/people/${id}`); }

  // reports
  installments(at: string) { return this.get<Installment[]>(`/installments?at=${at}`); }
  year(year: number) { return this.get<YearView>(`/years/${year}`); }
  undo(token: string) { return this.post<{ message: string }>(`/undo/${token}`); }
}
