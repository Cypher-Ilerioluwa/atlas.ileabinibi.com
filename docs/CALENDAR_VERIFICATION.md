# Kọ́jọ́dá calendar verification

Source of the rules: the owner's own calendar app, kept unchanged at `docs/reference/kojoda-original.html` (live at https://kojoda.netlify.app/).

## Rules taken from the original
- 13 months of 28 days (364 days); each month has 7 weeks of 4 days; 91 weeks a year.
- Day 0 of the cycle is **3 June** (Gregorian). A date before 3 June belongs to the cycle that began the previous June.
- Gregorian days beyond day 363 (the one or two extra days of a Gregorian year) are kept on the last day, as the original does.
- Quarters by month: Q1 months 1-3, Q2 months 4-6, Q3 months 7-9, Q4 months 10-13.
- Month names, seasons, colours and the 89 festival days are copied from the original.

## How it was checked (`npm test`, file `tests/kojoda.test.js`)
The test runs the original app's own code, unchanged, in a sandbox with a controllable clock, and compares it with `src/js/calendar/kojoda.js`:
- the structure and all 13 month names and seasons;
- all 89 festivals (name, description, type, icon);
- the day number for **every day from 2019 to 2045 at 00:00, 12:00 and 23:59** (over 29,000 comparisons);
- the Gregorian date of every day of seven different cycles, including leap-year cycles;
- cycle boundaries, the extra days, round trips in both directions, and input checks.

## Known differences from the original (deliberate)
1. The original names no year. Here a cycle is labelled by the Gregorian year it starts in (for example "cycle starting 3 June 2026"). This is a label, not a numbering from the original.
2. The original compares clock times. In time zones with daylight saving, the last hour of a winter day can show the next day's number there. The module uses calendar dates only, so it is exact. The tests run in Africa/Lagos, which has no daylight saving, where both agree everywhere.
3. Festival descriptions use "Abínibí" where the original says "Yoruba", following the site wording rule.
