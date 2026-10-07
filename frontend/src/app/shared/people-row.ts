import { Entry } from '../core/models';
import { STAT, chipStyle, inr, ymShort } from '../core/format';

/** Display details for one "they owe me" / "I owe them" row (shared by Overview and People). */
export function personRow(r: Entry) {
  const done = r.status === 'done', moved = r.status === 'moved', inbound = r.direction === 'in';
  const s = moved ? STAT.skipped : done ? STAT.paid : STAT.unpaid;
  const base = {
    r, done, moved,
    initial: r.name.charAt(0).toUpperCase(),
    chip: chipStyle(s),
    canToggle: !moved, canEdit: !r.auto && !moved, canDelete: !r.auto && !r.planId && !moved,
  };
  if (moved) {
    const to = ymShort(r.movedTo!);
    return { ...base, avatarBg: '#EEF0F3', avatarFg: '#4B5563', sub: `Carried over to ${to} — track it there`, shortSub: `Moved to ${to}`, statusLabel: `Moved to ${to}`, nameStyle: 'font-weight: 600; color: #4B5563', btnLabel: '', btnStyle: '' };
  }
  const instTxt = r.inst
    ? `Installment ${r.inst.n} of ${r.inst.total} · ${inr(r.amount * (r.inst.total - r.inst.n))} left after this`
    : r.note || 'One-time';
  return {
    ...base,
    avatarBg: r.auto || !inbound ? '#FDEDE3' : '#E8EEFC',
    avatarFg: r.auto || !inbound ? '#9A3412' : '#1D4ED8',
    sub: (r.auto ? `Auto from ${r.auto} EMI · ` : '') + instTxt,
    shortSub: r.auto && r.inst ? `EMI on ${r.auto} · ${r.inst.n} of ${r.inst.total}` : r.inst ? `Installment ${r.inst.n} of ${r.inst.total}` : r.note || 'One-time',
    statusLabel: done ? (inbound ? 'Received' : 'Paid back') : 'Pending',
    nameStyle: 'font-weight: 600; ' + (done ? 'color: #4B5563' : ''),
    btnLabel: done ? 'Undo' : inbound ? 'Mark received' : 'Mark paid back',
    btnStyle: done ? '' : 'background: #1D4ED8; border-color: #1D4ED8; color: #fff',
  };
}
export type PersonRow = ReturnType<typeof personRow>;
