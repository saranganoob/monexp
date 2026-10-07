import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Store } from '../../core/store';
import { Api, errorMessage } from '../../core/api.service';
import { Auth } from '../../core/auth';
import { Card, PersonStats } from '../../core/models';
import { MONTHS, inr, segStyle, val, ymIndex, ymLabel, ymMonth0 } from '../../core/format';

type Tab = 'account' | 'cards' | 'persons';
const FACE: Record<string, string> = { Visa: '#1A2B6D', RuPay: '#0F5C4A', Maestro: '#0E4A86', Mastercard: '#2B2F38' };

@Component({
  selector: 'app-profile',
  templateUrl: './profile.html',
})
export class ProfilePage {
  protected store = inject(Store);
  private api = inject(Api);
  private auth = inject(Auth);
  protected inr = inr;
  protected val = val;
  protected segStyle = segStyle;

  readonly tab = input<string>();
  protected picked = signal<Tab | null>(null);
  protected current = computed<Tab>(() => this.picked() ?? (['cards', 'persons'].includes(this.tab() ?? '') ? (this.tab() as Tab) : 'account'));
  protected tabs = computed(() => [
    ['account', 'Account'], ['cards', `Credit cards · ${this.store.cards().length}`], ['persons', `People · ${this.store.people().length}`],
  ] as [Tab, string][]);

  // ---------- account ----------
  protected accEmail = signal('');
  protected accPhone = signal('');
  protected accErr = signal('');
  protected accStatus = signal('');

  constructor() {
    effect(() => {
      const a = this.auth.account();
      this.accEmail.set(a?.email ?? '');
      this.accPhone.set(a?.phone ?? '');
    });
  }

  async saveAccount() {
    this.accErr.set(''); this.accStatus.set('');
    try {
      this.auth.account.set(await this.api.updateMe({ email: this.accEmail().trim(), phone: this.accPhone().replace(/\D/g, '') }));
      this.accStatus.set('Saved');
    } catch (e) {
      this.accErr.set(errorMessage(e));
    }
  }
  async signOut() {
    await this.auth.logout();
    location.assign('/login');
  }

  // ---------- cards ----------
  protected cardMsg = signal<{ id: string; text: string } | null>(null);
  protected cardEdit = signal<string | null>(null);
  protected cfName = signal('');
  protected cfLast4 = signal('');
  protected cfNet = signal('');
  protected cfErr = signal('');

  protected cardTiles = computed(() => {
    const I = ymIndex(this.store.ym());
    const label = ymLabel(this.store.ym());
    const month = this.store.month();
    return this.store.cards().map((c) => {
      const running = this.store.emis().filter((e) => e.cardId === c.id && ymIndex(e.startYm) <= I && ymIndex(e.startYm) + e.totalMonths - 1 >= I).length;
      const bill = month?.cards.find((x) => x.id === c.id)?.total ?? 0;
      const face = FACE[c.network] ?? '#3F4654';
      return {
        c,
        face: `padding: 18px; color: #fff; display: flex; flex-direction: column; gap: 22px; background: linear-gradient(135deg, ${face}, #111827); ${c.closedOn ? 'opacity: .6' : ''}`,
        stats: c.closedOn
          ? `Closed on ${Number(c.closedOn.slice(8, 10))} ${MONTHS[Number(c.closedOn.slice(5, 7)) - 1]} ${c.closedOn.slice(0, 4)} · kept for history`
          : `Active · ${label} bill ${inr(bill)} · ${running} EMI${running === 1 ? '' : 's'} running`,
      };
    });
  });

  editCard(c: Card) {
    this.cardEdit.set(c.id); this.cfName.set(c.name); this.cfLast4.set(c.last4); this.cfNet.set(c.network); this.cfErr.set(''); this.cardMsg.set(null);
    setTimeout(() => document.getElementById('cfName')?.focus());
  }
  cancelCard() { this.cardEdit.set(null); this.cfName.set(''); this.cfLast4.set(''); this.cfNet.set(''); this.cfErr.set(''); }
  toggleClosed(c: Card) { this.cardMsg.set(null); this.store.run(this.api.updateCard(c.id, { closed: !c.closedOn })); }
  async deleteCard(c: Card) {
    const error = await this.store.run(this.api.deleteCard(c.id), { quiet: true });
    this.cardMsg.set(error ? { id: c.id, text: error } : null);
  }
  async saveCard() {
    const name = this.cfName().trim(), last4 = this.cfLast4();
    if (!name) return this.cfErr.set('Add the card’s name.');
    if (!/^\d{4}$/.test(last4)) return this.cfErr.set('Enter exactly the last 4 digits.');
    if (!this.cfNet()) return this.cfErr.set('Choose the card network.');
    const id = this.cardEdit();
    const error = await this.store.run(
      id ? this.api.updateCard(id, { name, last4, network: this.cfNet() })
        : this.api.addCard({ name, last4, network: this.cfNet(), addToYm: this.store.ym() }),
      { quiet: true },
    );
    if (error) return this.cfErr.set(error);
    this.cancelCard();
  }

  // ---------- people ----------
  protected personMsg = signal<{ id: string; text: string } | null>(null);
  protected personEdit = signal<string | null>(null);
  protected pfName = signal('');
  protected pfRel = signal('');
  protected pfPhone = signal('');
  protected pfUpi = signal('');
  protected pfNote = signal('');
  protected pfErr = signal('');
  protected monthShort = computed(() => MONTHS[ymMonth0(this.store.ym())]);
  protected owedTotal = computed(() => this.store.people().reduce((s, p) => s + p.owed, 0));

  personView(p: PersonStats) {
    const bits: string[] = [];
    if (p.runningEmis) bits.push(`${p.runningEmis} EMI${p.runningEmis > 1 ? 's' : ''} running · ${inr(p.leftToRecover)} left to recover`);
    bits.push(`${inr(p.receivedSoFar)} received so far`);
    const youOwe = p.iOwe > 0 && !p.owed;
    return {
      contact: [p.phone ? '+91 ' + p.phone : '', p.upi, p.note].filter(Boolean).join(' · ') || 'No phone or UPI saved',
      stats: bits.join(' · '),
      owedStr: inr(youOwe ? p.iOwe : p.owed),
      owedLabel: `${youOwe ? 'you owe' : 'owes you'} · ${this.monthShort()}`,
      owedColor: youOwe ? '#9A3412' : p.owed ? '#1D4ED8' : '#4B5563',
    };
  }

  editPerson(p: PersonStats) {
    this.personEdit.set(p.id); this.pfName.set(p.name); this.pfRel.set(p.relation); this.pfPhone.set(p.phone); this.pfUpi.set(p.upi); this.pfNote.set(p.note);
    this.pfErr.set(''); this.personMsg.set(null);
    setTimeout(() => { document.getElementById('person-form')?.scrollIntoView({ behavior: 'smooth' }); document.getElementById('pfName')?.focus({ preventScroll: true }); });
  }
  cancelPerson() { this.personEdit.set(null); this.pfName.set(''); this.pfRel.set(''); this.pfPhone.set(''); this.pfUpi.set(''); this.pfNote.set(''); this.pfErr.set(''); }
  async deletePerson(p: PersonStats) {
    const error = await this.store.run(this.api.deletePerson(p.id), { quiet: true });
    this.personMsg.set(error ? { id: p.id, text: error } : null);
  }
  async savePerson() {
    const name = this.pfName().trim(), phone = this.pfPhone(), upi = this.pfUpi().trim();
    if (!name) return this.pfErr.set('Add a name.');
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return this.pfErr.set('Enter a 10-digit Indian mobile number, or leave it empty.');
    if (upi && !/^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return this.pfErr.set('A UPI ID looks like name@bank.');
    const body = { name, relation: this.pfRel(), phone, upi, note: this.pfNote().trim() };
    const id = this.personEdit();
    const error = await this.store.run(id ? this.api.updatePerson(id, body) : this.api.addPerson(body), { quiet: true });
    if (error) return this.pfErr.set(error);
    this.cancelPerson();
  }
}
