import { Component, computed, inject, input, signal } from '@angular/core';
import { Store } from '../../core/store';
import { Api } from '../../core/api.service';
import { Entry } from '../../core/models';
import { fmtInput, inr, parseNum, segStyle, val } from '../../core/format';
import { personRow } from '../../shared/people-row';
import { toggleEntry } from '../../shared/entry-actions';

@Component({
  selector: 'app-people',
  templateUrl: './people.html',
})
export class PeoplePage {
  protected store = inject(Store);
  private api = inject(Api);
  protected inr = inr;
  protected val = val;
  protected segStyle = segStyle;

  /** ?tab=out from the Add expense dialog. */
  readonly tab = input<string>();
  private picked = signal<'in' | 'out' | null>(null);
  protected dir = computed(() => this.picked() ?? (this.tab() === 'out' ? 'out' : 'in'));

  protected m = this.store.month;
  protected rows = computed(() => {
    const m = this.m();
    return m ? (this.dir() === 'in' ? m.receivables : m.payables).map(personRow) : [];
  });

  protected editId = signal<string | null>(null);
  protected rowName = signal('');
  protected rowAmt = signal('');
  protected rowErr = signal('');
  protected pName = signal('');
  protected pAmt = signal('');
  protected addErr = signal('');

  pick(d: 'in' | 'out') { this.picked.set(d); this.editId.set(null); }
  toggle(r: Entry) { toggleEntry(this.api, this.store, r); }
  remove(r: Entry) { this.store.run(this.api.deleteEntry(r.id)); }

  edit(r: Entry) {
    this.editId.set(r.id);
    this.rowName.set(r.name);
    this.rowAmt.set(fmtInput(r.amount));
    this.rowErr.set('');
    setTimeout(() => document.getElementById('rowAmt')?.focus());
  }

  async saveRow() {
    const id = this.editId(), nm = this.rowName().trim(), v = parseNum(this.rowAmt());
    if (!id) return;
    if (!nm) return this.rowErr.set('Add who this is.');
    if (!v) return this.rowErr.set('Enter an amount above ₹0 — or delete the entry if nothing is due.');
    const error = await this.store.run(this.api.updateEntry(id, { name: nm, amount: v }), { quiet: true });
    if (error) return this.rowErr.set(error);
    this.editId.set(null);
  }

  async add() {
    const nm = this.pName().trim(), a = parseNum(this.pAmt());
    if (!nm || !a) return this.addErr.set('Add who it is and an amount above ₹0.');
    const error = await this.store.run(this.api.addEntry(this.store.ym(), { direction: this.dir(), name: nm, amount: a }), { quiet: true });
    if (error) return this.addErr.set(error);
    this.pName.set(''); this.pAmt.set(''); this.addErr.set('');
  }
}
