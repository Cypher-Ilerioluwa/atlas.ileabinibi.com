# Kọ́jọ́dá calendar verification

Reference: https://kojoda.netlify.app/ (owner's app). Its page is rendered by JavaScript, so the rules could not be read from outside.
Observed UI only: title "364 — Yoruba Calendar", "Month 1 · Òkúdù • The Source", counters for Day, Week, Weekday, Quarter, and labels Ifa, Osun, Ogun, Sango, Egungun, Harvest.

## Needed from the owner
The app's source (index.html and scripts) or a zip, to establish:
1. Month names, order and diacritics. 2. Day names and sequence. 3. Year start and numbering. 4. How a 364-day year aligns with 365/366-day Gregorian years (extra day rules).
5. Quarter and "week" definitions. 6. Special days (Ifa, Osun, Ogun, Sango, Egungun, Harvest) and how they are chosen.

## Procedure
1. Port the logic into `src/js/calendar/kojoda.js` without changing rules; set `VERIFIED = true` only after step 3.
2. Record at least 30 reference dates from the app (year start, month/quarter boundaries, final days of the year, extra-day dates, leap years) in `tests/kojoda.test.js`.
3. Run `npm test`; every case must match the app exactly, in both directions.
Public sources (e.g. Wikipedia) describe a 4-day week, 7-week months, 13 months and a 3 June start, but these are NOT used as rules here.
