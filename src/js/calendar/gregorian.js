// Pure Gregorian helpers (no Kọ́jọ́dá logic here).
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
/** Monday-first weekday index (0..6) of the 1st of the month. */
export const firstWeekday = (y, m) => (new Date(y, m, 1).getDay() + 6) % 7;
export const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
