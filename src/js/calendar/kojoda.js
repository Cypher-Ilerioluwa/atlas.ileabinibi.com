// KỌ́JỌ́DÁ CALENDAR MODULE: UNVERIFIED STUB.
// The rules (month names/order, day names, year start, leap handling, conversion) must be taken
// from the original app at https://kojoda.netlify.app/ . Nothing is implemented here on purpose:
// see docs/CALENDAR_VERIFICATION.md. Until VERIFIED is true, the UI shows no Kọ́jọ́dá dates.
export const VERIFIED = false;
export const SOURCE = 'https://kojoda.netlify.app/';

export function fromGregorian(/* date */) {
  return { verified: false, reason: 'Kọ́jọ́dá rules not yet imported from the reference app.' };
}
export function toGregorian(/* kojodaDate */) {
  return { verified: false, reason: 'Kọ́jọ́dá rules not yet imported from the reference app.' };
}
