import { Installment } from '../../core/models';
import { BarTone } from '../ui/progress-bar/progress-bar';

/** Colour of an installment's bar/ring: someone paying me (blue), a friend's EMI (orange), mine (navy). */
export const installmentTone = (i: Installment): BarTone => (i.incoming ? 'incoming' : i.friend ? 'friend' : 'navy');
