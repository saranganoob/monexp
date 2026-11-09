import { Entry } from '../../core/models';
import { inr, ymShort } from '../../core/utils/format';

/** Everything a "they owe me / I owe them" row shows (used by Overview and People). */
export interface PersonRow {
  r: Entry;
  done: boolean;
  moved: boolean;
  avatarTone: 'blue' | 'orange' | 'grey';
  sub: string;
  shortSub: string;
  status: 'paid' | 'pending' | 'partial' | 'moved';
  statusLabel: string;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  btnLabel: string;
  /** Pending rows get a blue "Mark received" button; done rows a plain "Undo". */
  btnPrimary: boolean;
  /** Part of it settled so far (₹6,000 of ₹10,000): `settled`, what's `left`, and the share as a %. */
  partial: boolean;
  settled: number;
  left: number;
  pct: number;
  /** A part can be recorded (pending, not a friend's EMI row). */
  canPart: boolean;
}

export function personRow(r: Entry): PersonRow {
  const done = r.status === 'done', moved = r.status === 'moved', inbound = r.direction === 'in';
  const settled = done ? r.amount : r.paid ?? 0;
  const left = r.status === 'pending' ? r.left ?? r.amount : 0;
  const partial = r.status === 'pending' && settled > 0;
  const base = {
    r, done, moved, canToggle: !moved, canEdit: !r.auto && !moved, canDelete: !r.auto && !r.planId && !moved,
    partial, settled, left, pct: r.amount ? Math.round((settled / r.amount) * 100) : 0, canPart: r.status === 'pending' && !r.emiId,
  };
  if (moved) {
    const to = ymShort(r.movedTo!);
    return {
      ...base, avatarTone: 'grey', status: 'moved', statusLabel: `Moved to ${to}`,
      sub: `Carried over to ${to} — track it there`, shortSub: `Moved to ${to}`, btnLabel: '', btnPrimary: false,
    };
  }
  const ongoing = !!r.inst && r.inst.total == null; // no end date
  const nOfTotal = r.inst ? (ongoing ? `month ${r.inst.n} · ongoing` : `${r.inst.n} of ${r.inst.total}`) : '';
  const instTxt = r.inst
    ? (ongoing ? `Installment ${nOfTotal}` : `Installment ${nOfTotal} · ${inr(r.amount * (r.inst.total! - r.inst.n))} left after this`)
    : r.note || 'One-time';
  const partTxt = partial ? `${inr(settled)} of ${inr(r.amount)} ${inbound ? 'received' : 'paid back'} · ${inr(left)} left` : '';
  return {
    ...base,
    avatarTone: r.auto || !inbound ? 'orange' : 'blue',
    status: done ? 'paid' : partial ? 'partial' : 'pending',
    statusLabel: done ? (inbound ? 'Received' : 'Paid back') : partial ? (inbound ? 'Part received' : 'Part paid') : 'Pending',
    sub: partTxt || (r.auto ? `Auto from ${r.auto} EMI · ` : '') + instTxt,
    shortSub: partTxt || (r.auto && r.inst ? `EMI on ${r.auto} · ${nOfTotal}`
      : r.inst ? `Installment ${nOfTotal}` : r.note || 'One-time'),
    btnLabel: done ? 'Undo' : partial ? (inbound ? 'Rest received' : 'Rest paid back') : inbound ? 'Mark received' : 'Mark paid back',
    btnPrimary: !done,
  };
}
