// Home-language hints: the app stays in English; when someone picks a home language, a small
// line in that script appears under a few money words. Add a language or a label here –
// every <app-lang-hint> picks it up.
// ⚠ The Telugu and Hindi wording still needs a native speaker's review before release.
import { HomeLang } from '../models';

export interface HomeLanguage { code: HomeLang; name: string; english: string; }

export const HOME_LANGUAGES: HomeLanguage[] = [
  { code: 'ta', name: 'தமிழ்', english: 'Tamil' },
  { code: 'te', name: 'తెలుగు', english: 'Telugu' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi' },
];

/** Which English label each hint goes under. */
export type HintKey = 'theyOweMe' | 'iOweThem';

export const HINT_LABELS: Record<HintKey, string> = {
  theyOweMe: 'They owe me',
  iOweThem: 'I owe them',
};

export const HINTS: Record<HomeLang, Record<HintKey, string>> = {
  ta: { theyOweMe: 'கடன் கொடுத்தது', iOweThem: 'கடன் வாங்கியது' },
  te: { theyOweMe: 'ఇచ్చిన అప్పు', iOweThem: 'తీసుకున్న అప్పు' },
  hi: { theyOweMe: 'उधार दिया', iOweThem: 'उधार लिया' },
};
