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
  status: 'paid' | 'pending' | 'moved';
  statusLabel: string;
  canToggle: boolean;
  canEdit: boolean;
  canDelete: boolean;
  btnLabel: string;
  /** Pending rows get a blue "Mark received" button; done rows a plain "Undo". */
  btnPrimary: boolean;
}

export function personRow(r: Entry): PersonRow {
  const done = r.status === 'done', moved = r.status === 'moved', inbound = r.direction === 'in';
  const base = { r, done, moved, canToggle: !moved, canEdit: !r.auto && !moved, canDelete: !r.auto && !r.planId && !moved };
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
  return {
    ...base,
    avatarTone: r.auto || !inbound ? 'orange' : 'blue',
    status: done ? 'paid' : 'pending',
    statusLabel: done ? (inbound ? 'Received' : 'Paid back') : 'Pending',
    sub: (r.auto ? `Auto from ${r.auto} EMI · ` : '') + instTxt,
    shortSub: r.auto && r.inst ? `EMI on ${r.auto} · ${nOfTotal}`
      : r.inst ? `Installment ${nOfTotal}` : r.note || 'One-time',
    btnLabel: done ? 'Undo' : inbound ? 'Mark received' : 'Mark paid back',
    btnPrimary: !done,
  };
}
