import { AfterViewInit, Component, ElementRef, inject, input, output, signal } from '@angular/core';
import { Store } from '../core/store';
import { Api } from '../core/api.service';
import { Bill } from '../core/models';
import { fmtInput, parseNum, val } from '../core/format';

/** Inline form to change a bill's name, amount, group, due day and note. */
@Component({
  selector: 'app-bill-editor',
  template: `
    <div style="background: #F3F6FD; border: 1.5px solid #1D4ED8; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px" (keydown.escape)="done.emit()">
      <div style="font-size: 13px; font-weight: 700; color: #1E3A8A">Edit {{ bill().name }}</div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 150px), 1fr)); gap: 10px; align-items: end">
        <div style="grid-column: span 2; min-width: 0"><label [for]="id + 'n'" class="label" style="display: block; margin-bottom: 6px">Name</label>
          <input [id]="id + 'n'" class="field" [value]="name()" (input)="name.set(val($event)); err.set('')" (keydown.enter)="save()"></div>
        <div><label [for]="id + 'a'" class="label" style="display: block; margin-bottom: 6px">Amount (₹)</label>
          <input [id]="id + 'a'" class="field num" inputmode="numeric" [value]="amount()" (input)="amount.set(val($event)); err.set('')" (keydown.enter)="save()"></div>
        <div><label [for]="id + 'c'" class="label" style="display: block; margin-bottom: 6px">Group</label>
          <select [id]="id + 'c'" class="field" (change)="category.set(val($event))">
            @for (c of groups; track c[0]) { <option [value]="c[0]" [selected]="category() === c[0]">{{ c[1] }}</option> }
          </select></div>
        <div><label [for]="id + 'd'" class="label" style="display: block; margin-bottom: 6px">Due day</label>
          <input [id]="id + 'd'" class="field num" inputmode="numeric" [value]="due()" (input)="due.set(val($event)); err.set('')" (keydown.enter)="save()" placeholder="1–31"></div>
        <div style="grid-column: 1 / -1"><label [for]="id + 'o'" class="label" style="display: block; margin-bottom: 6px">Note (optional)</label>
          <input [id]="id + 'o'" class="field" [value]="note()" (input)="note.set(val($event))" (keydown.enter)="save()" placeholder="e.g. Paid via UPI"></div>
      </div>
      @if (bill().planId) {
        <div style="font-size: 13px; color: #374151">This changes this month only. To change every month, edit the plan on the Installments page.</div>
      }
      @if (err()) { <div role="alert" style="font-size: 13px; color: #A3201A; font-weight: 600">{{ err() }}</div> }
      <div style="display: flex; gap: 8px"><button class="btn btn-primary" (click)="save()">Save</button><button class="btn" (click)="done.emit()">Cancel</button></div>
    </div>
  `,
})
export class BillEditor implements AfterViewInit {
  private store = inject(Store);
  private api = inject(Api);
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly bill = input.required<Bill>();
  readonly done = output<void>();
  protected val = val;
  protected id = 'be-' + Math.random().toString(36).slice(2);
  protected readonly groups = [['fam', 'Family & personal'], ['sub', 'Subscriptions'], ['house', 'Housing'], ['inv', 'Investments & savings']];

  protected name = signal('');
  protected amount = signal('');
  protected category = signal('fam');
  protected due = signal('');
  protected note = signal('');
  protected err = signal('');

  ngAfterViewInit() {
    const b = this.bill();
    this.name.set(b.name);
    this.amount.set(b.amount ? fmtInput(b.amount) : '0');
    this.category.set(b.category);
    this.due.set(b.dueDay ? String(b.dueDay) : '');
    this.note.set(b.note);
    setTimeout(() => this.el.nativeElement.querySelector<HTMLInputElement>(`#${this.id}a`)?.select());
  }

  async save() {
    const name = this.name().trim();
    if (!name) return this.err.set('Add a name.');
    if (!this.amount().trim()) return this.err.set('Enter the amount (₹0 is fine).');
    const due = this.due().trim() ? Number(this.due()) : null;
    if (due !== null && (!Number.isInteger(due) || due < 1 || due > 31)) return this.err.set('Due day must be between 1 and 31, or empty.');
    const error = await this.store.run(this.api.updateBill(this.bill().id, {
      name, amount: parseNum(this.amount()), category: this.category(), dueDay: due, note: this.note().trim(),
    }), { quiet: true });
    if (error) return this.err.set(error);
    this.done.emit();
  }
}
