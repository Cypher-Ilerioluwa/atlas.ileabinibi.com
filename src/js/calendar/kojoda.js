// KỌ́JỌ́DÁ CALENDAR MODULE. Rules are taken from the owner's reference app (docs/reference/kojoda-original.html,
// https://kojoda.netlify.app/): 13 months x 28 days = 364 days, 4-day weeks (7 per month, 91 per year),
// the cycle begins on 3 June (day 0) and Gregorian days beyond day 363 stay on the last day.
// Pure functions, no DOM. Tested against the original code in tests/kojoda.test.js.
// Text wording rule: "Yoruba" is shown as "Abínibí" in festival descriptions, as for the rest of the site.
export const VERIFIED = true;
export const SOURCE = 'https://kojoda.netlify.app/';
export const CONFIG = { daysPerMonth: 28, daysPerWeek: 4, weeksPerMonth: 7, monthsPerYear: 13, totalDays: 364, anchorMonth: 5, anchorDay: 3 };
export const MONTHS = [
 {
  "name": "Òkúdù",
  "primary": "#6366f1",
  "secondary": "#8b5cf6",
  "season": "The Source"
 },
 {
  "name": "Agẹmo",
  "primary": "#06b6d4",
  "secondary": "#3b82f6",
  "season": "The Messenger"
 },
 {
  "name": "Ògún",
  "primary": "#10b981",
  "secondary": "#06b6d4",
  "season": "The Forge"
 },
 {
  "name": "Ọwẹ́wẹ̀",
  "primary": "#22c55e",
  "secondary": "#10b981",
  "season": "The Harvest"
 },
 {
  "name": "Ọ̀wàrà",
  "primary": "#84cc16",
  "secondary": "#22c55e",
  "season": "The Storm"
 },
 {
  "name": "Bélú",
  "primary": "#eab308",
  "secondary": "#84cc16",
  "season": "The Gathering"
 },
 {
  "name": "Ọ̀pẹ",
  "primary": "#f59e0b",
  "secondary": "#eab308",
  "season": "The Palm"
 },
 {
  "name": "Ṣẹrẹ",
  "primary": "#f97316",
  "secondary": "#f59e0b",
  "season": "The White Cloth"
 },
 {
  "name": "Èrèlé",
  "primary": "#ef4444",
  "secondary": "#f97316",
  "season": "The Deep"
 },
 {
  "name": "Ẹrẹ́nà",
  "primary": "#ec4899",
  "secondary": "#ef4444",
  "season": "The Ancient"
 },
 {
  "name": "Igbe",
  "primary": "#d946ef",
  "secondary": "#ec4899",
  "season": "The Proclamation"
 },
 {
  "name": "Èbìbì",
  "primary": "#a855f7",
  "secondary": "#d946ef",
  "season": "The Mask"
 },
 {
  "name": "Ìrànlọ́wọ́",
  "primary": "#8b5cf6",
  "secondary": "#6366f1",
  "season": "The Preparation"
 }
];
export const QUARTERS = ['Q1','Q1','Q1','Q2','Q2','Q2','Q3','Q3','Q3','Q4','Q4','Q4','Q4'];
// Festival type keys come from the reference app; the display labels below are plain names of each key.
export const FESTIVAL_TYPES = { ifa: 'Ifá', osun: 'Ọ̀ṣun and water', ogun: 'Ògún', sango: 'Ṣàngó', egungun: 'Egúngún and ancestors', yam: 'Yam and harvest', oya: 'Ọya', obatala: 'Ọbàtálá', olokun: 'Olókun', oduduwa: 'Odùduwà', general: 'Other observances' };
export const FESTIVALS = {
 "0": {
  "name": "Odun Tuntun",
  "desc": "Abínibí New Year & Ifa Festival",
  "type": "ifa",
  "icon": "✦"
 },
 "1": {
  "name": "Ijawe Ifa",
  "desc": "Leaf-picking for the Oracle",
  "type": "ifa",
  "icon": "✦"
 },
 "2": {
  "name": "Arisun Idana",
  "desc": "Culinary vigil at the Palace",
  "type": "ifa",
  "icon": "✦"
 },
 "3": {
  "name": "Bibo Ifa",
  "desc": "Sacrifice for the Ooni's Oracle",
  "type": "ifa",
  "icon": "✦"
 },
 "7": {
  "name": "Awo Oloju",
  "desc": "Sixteen-Faced Cult rites",
  "type": "ifa",
  "icon": "✦"
 },
 "14": {
  "name": "Iwure",
  "desc": "Blessings by Araba Agbaye",
  "type": "ifa",
  "icon": "✦"
 },
 "17": {
  "name": "Yemoja",
  "desc": "Mother of the Orisa, fertility & water",
  "type": "osun",
  "icon": "≈"
 },
 "18": {
  "name": "Yemoja",
  "desc": "Annual rites of passage for women",
  "type": "osun",
  "icon": "≈"
 },
 "19": {
  "name": "Yemoja",
  "desc": "Sacred river offerings",
  "type": "osun",
  "icon": "≈"
 },
 "20": {
  "name": "Yemoja",
  "desc": "Community water blessings",
  "type": "osun",
  "icon": "≈"
 },
 "23": {
  "name": "Sopona",
  "desc": "Orisa of healing & smallpox",
  "type": "general",
  "icon": "◉"
 },
 "24": {
  "name": "Osanyin",
  "desc": "Plants, magic & medicine",
  "type": "general",
  "icon": "◉"
 },
 "28": {
  "name": "Agẹmo Festival",
  "desc": "Ijebu sacred festival begins",
  "type": "general",
  "icon": "◈"
 },
 "29": {
  "name": "Agẹmo",
  "desc": "Sacred messenger rites continue",
  "type": "general",
  "icon": "◈"
 },
 "34": {
  "name": "Esu Elegba",
  "desc": "Divine messenger & crossroads",
  "type": "general",
  "icon": "◉"
 },
 "41": {
  "name": "Oko Festival",
  "desc": "Agriculture & harvest thanksgiving",
  "type": "yam",
  "icon": "✻"
 },
 "48": {
  "name": "Oko",
  "desc": "Farm blessings & planting rituals",
  "type": "yam",
  "icon": "✻"
 },
 "56": {
  "name": "Ogun Festival",
  "desc": "Orisa of iron, war & truth",
  "type": "ogun",
  "icon": "⚔"
 },
 "57": {
  "name": "Ogun",
  "desc": "Blacksmiths & warriors honored",
  "type": "ogun",
  "icon": "⚔"
 },
 "58": {
  "name": "Ogun",
  "desc": "Legal profession oath renewal",
  "type": "ogun",
  "icon": "⚔"
 },
 "63": {
  "name": "Osun-Osogbo",
  "desc": "River goddess of fertility",
  "type": "osun",
  "icon": "≈"
 },
 "64": {
  "name": "Osun",
  "desc": "Sacred calabash procession",
  "type": "osun",
  "icon": "≈"
 },
 "65": {
  "name": "Osun",
  "desc": "Arugba virgin bearer rites",
  "type": "osun",
  "icon": "≈"
 },
 "70": {
  "name": "Sango Festival",
  "desc": "Thunder, lightning & justice",
  "type": "sango",
  "icon": "⚡"
 },
 "71": {
  "name": "Sango",
  "desc": "Drumming & battle reenactments",
  "type": "sango",
  "icon": "⚡"
 },
 "72": {
  "name": "Sango",
  "desc": "Fire rituals & energy blessings",
  "type": "sango",
  "icon": "⚡"
 },
 "77": {
  "name": "Agbado",
  "desc": "Corn harvest celebration",
  "type": "yam",
  "icon": "✻"
 },
 "78": {
  "name": "Agbado",
  "desc": "Gratitude for bounty",
  "type": "yam",
  "icon": "✻"
 },
 "84": {
  "name": "Iriji-Mmanu",
  "desc": "New Yam Festival begins",
  "type": "yam",
  "icon": "✻"
 },
 "85": {
  "name": "New Yam",
  "desc": "First yam to elders & chief",
  "type": "yam",
  "icon": "✻"
 },
 "86": {
  "name": "New Yam",
  "desc": "Community feasting & dances",
  "type": "yam",
  "icon": "✻"
 },
 "91": {
  "name": "Mama Osun",
  "desc": "Day of the river goddess",
  "type": "osun",
  "icon": "≈"
 },
 "98": {
  "name": "Olojo Festival",
  "desc": "Day of the First Dawn",
  "type": "ifa",
  "icon": "✦"
 },
 "99": {
  "name": "Olojo",
  "desc": "Ooni emerges from seclusion",
  "type": "ifa",
  "icon": "✦"
 },
 "100": {
  "name": "Olojo",
  "desc": "Are Crown procession",
  "type": "ifa",
  "icon": "✦"
 },
 "101": {
  "name": "Olojo",
  "desc": "Okemogun shrine rituals",
  "type": "ifa",
  "icon": "✦"
 },
 "102": {
  "name": "Olojo",
  "desc": "Divination for the coming year",
  "type": "ifa",
  "icon": "✦"
 },
 "105": {
  "name": "Itapa",
  "desc": "Sacred grove ceremonies",
  "type": "general",
  "icon": "◉"
 },
 "112": {
  "name": "Oya Festival",
  "desc": "Orisa of winds & change",
  "type": "oya",
  "icon": "☁"
 },
 "113": {
  "name": "Oya",
  "desc": "Guardian of the gateway",
  "type": "oya",
  "icon": "☁"
 },
 "114": {
  "name": "Oya",
  "desc": "Market women honored",
  "type": "oya",
  "icon": "☁"
 },
 "119": {
  "name": "Olojo Finale",
  "desc": "Closing blessings & prayers",
  "type": "ifa",
  "icon": "✦"
 },
 "126": {
  "name": "Sigidi",
  "desc": "Unsettled spirits & ancestors",
  "type": "egungun",
  "icon": "◐"
 },
 "133": {
  "name": "Dry Season",
  "desc": "Onset of Harmattan winds",
  "type": "general",
  "icon": "◉"
 },
 "140": {
  "name": "Eyo Festival",
  "desc": "Lagos masquerade for Obas",
  "type": "egungun",
  "icon": "◐"
 },
 "141": {
  "name": "Eyo",
  "desc": "White-clad spirit procession",
  "type": "egungun",
  "icon": "◐"
 },
 "142": {
  "name": "Eyo",
  "desc": "Opa candles & sacred rites",
  "type": "egungun",
  "icon": "◐"
 },
 "147": {
  "name": "Ancestral Veneration",
  "desc": "Community founder honors",
  "type": "egungun",
  "icon": "◐"
 },
 "154": {
  "name": "Cleansing",
  "desc": "Town purification rituals",
  "type": "general",
  "icon": "◉"
 },
 "168": {
  "name": "Obaluaye",
  "desc": "Orisa of disease & healing",
  "type": "general",
  "icon": "◉"
 },
 "169": {
  "name": "Sopona",
  "desc": "Smallpox deity rites",
  "type": "general",
  "icon": "◉"
 },
 "175": {
  "name": "Harmattan",
  "desc": "Dry season winds arrive",
  "type": "general",
  "icon": "◉"
 },
 "182": {
  "name": "Healing",
  "desc": "Medicine & herbal rites",
  "type": "general",
  "icon": "◉"
 },
 "189": {
  "name": "Orisa Oko",
  "desc": "Final harvest thanksgiving",
  "type": "yam",
  "icon": "✻"
 },
 "196": {
  "name": "Obatala",
  "desc": "Orisa of creation & purity",
  "type": "obatala",
  "icon": "◊"
 },
 "197": {
  "name": "Obatala",
  "desc": "White cloth & calmness",
  "type": "obatala",
  "icon": "◊"
 },
 "203": {
  "name": "Ita Obatala",
  "desc": "Divination for the elders",
  "type": "obatala",
  "icon": "◊"
 },
 "210": {
  "name": "New Moon",
  "desc": "Sacred lunar rites",
  "type": "general",
  "icon": "◉"
 },
 "217": {
  "name": "Egungun Prelim",
  "desc": "Ancestor mask preparations",
  "type": "egungun",
  "icon": "◐"
 },
 "224": {
  "name": "Olokun",
  "desc": "Orisa of deep seas & wealth",
  "type": "olokun",
  "icon": "≋"
 },
 "225": {
  "name": "Olokun",
  "desc": "Sailors & lost souls honored",
  "type": "olokun",
  "icon": "≋"
 },
 "231": {
  "name": "Olokun",
  "desc": "Underwater realm communion",
  "type": "olokun",
  "icon": "≋"
 },
 "238": {
  "name": "Gelede",
  "desc": "Motherhood & female power",
  "type": "general",
  "icon": "◈"
 },
 "239": {
  "name": "Gelede",
  "desc": "Masked dance ceremonies",
  "type": "general",
  "icon": "◈"
 },
 "245": {
  "name": "Iyami",
  "desc": "Night of the powerful mothers",
  "type": "general",
  "icon": "◉"
 },
 "252": {
  "name": "Oduduwa",
  "desc": "Progenitor of the Abínibí",
  "type": "oduduwa",
  "icon": "◉"
 },
 "253": {
  "name": "Oduduwa",
  "desc": "Ile-Ife creation rites",
  "type": "oduduwa",
  "icon": "◉"
 },
 "254": {
  "name": "Iyaagbe",
  "desc": "Earth mother ceremonies",
  "type": "oduduwa",
  "icon": "◉"
 },
 "261": {
  "name": "Rites of Passage",
  "desc": "Annual male initiation",
  "type": "general",
  "icon": "◉"
 },
 "268": {
  "name": "Ososi",
  "desc": "Orisa of adventure & hunt",
  "type": "general",
  "icon": "◉"
 },
 "273": {
  "name": "Oduduwa",
  "desc": "Sacred grove offerings",
  "type": "oduduwa",
  "icon": "◉"
 },
 "274": {
  "name": "Oduduwa",
  "desc": "Community lineage blessings",
  "type": "oduduwa",
  "icon": "◉"
 },
 "280": {
  "name": "Rainy Season",
  "desc": "Onset of spring rains",
  "type": "general",
  "icon": "◉"
 },
 "281": {
  "name": "Rain Invocation",
  "desc": "Prayers for crops",
  "type": "general",
  "icon": "◉"
 },
 "287": {
  "name": "Oke Itase",
  "desc": "Sacred hill ceremonies",
  "type": "general",
  "icon": "◉"
 },
 "294": {
  "name": "Ifa Divination",
  "desc": "Year-ahead prophecy",
  "type": "ifa",
  "icon": "✦"
 },
 "301": {
  "name": "Igbe",
  "desc": "Proclamation of the season",
  "type": "general",
  "icon": "◉"
 },
 "308": {
  "name": "Egungun Festival",
  "desc": "Commemoration of ancestors",
  "type": "egungun",
  "icon": "◐"
 },
 "309": {
  "name": "Egungun",
  "desc": "Ijebu mask ceremonies",
  "type": "egungun",
  "icon": "◐"
 },
 "310": {
  "name": "Egungun",
  "desc": "Community ancestor parade",
  "type": "egungun",
  "icon": "◐"
 },
 "315": {
  "name": "Ijebu Ebìbì",
  "desc": "Sacred town celebrations",
  "type": "egungun",
  "icon": "◐"
 },
 "322": {
  "name": "Ancestor Night",
  "desc": "Illustrious dead honored",
  "type": "egungun",
  "icon": "◐"
 },
 "329": {
  "name": "Founders Day",
  "desc": "Community founders remembered",
  "type": "egungun",
  "icon": "◐"
 },
 "336": {
  "name": "Ogun Rites",
  "desc": "Preparation for new year",
  "type": "ogun",
  "icon": "⚔"
 },
 "337": {
  "name": "Orisa Oko",
  "desc": "Planting blessings",
  "type": "yam",
  "icon": "✻"
 },
 "343": {
  "name": "Ifa Consultation",
  "desc": "Divination for coming year",
  "type": "ifa",
  "icon": "✦"
 },
 "350": {
  "name": "Purification",
  "desc": "Cleansing before new year",
  "type": "general",
  "icon": "◉"
 },
 "357": {
  "name": "Eve of New Year",
  "desc": "Final day of the cycle",
  "type": "ifa",
  "icon": "✦"
 },
 "363": {
  "name": "Odun Mimo",
  "desc": "Sacred night vigil",
  "type": "ifa",
  "icon": "✦"
 }
};

const DAY_MS = 86400000;
const utc = (y, m, d) => Date.UTC(y, m, d);
const parts = input => {
  if (typeof input === 'string') { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input); if (!m) throw new Error('Use a date like 2026-10-20'); return [+m[1], +m[2] - 1, +m[3]]; }
  if (input instanceof Date) return [input.getFullYear(), input.getMonth(), input.getDate()];
  if (input && typeof input === 'object') return [input.year, input.month, input.day];
  throw new Error('Unsupported date');
};
const ymd = ms => { const d = new Date(ms); return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() }; };

/** Gregorian year in which the cycle containing this date began (3 June of that year). */
export function cycleYearOf(input) {
  const [y, m, d] = parts(input);
  return utc(y, m, d) < utc(y, CONFIG.anchorMonth, CONFIG.anchorDay) ? y - 1 : y;
}
/** Actual number of Gregorian days in the cycle that begins in `cycleYear` (365 or 366). */
export const gregorianDaysInCycle = cycleYear => Math.round((utc(cycleYear + 1, CONFIG.anchorMonth, CONFIG.anchorDay) - utc(cycleYear, CONFIG.anchorMonth, CONFIG.anchorDay)) / DAY_MS);

/** Gregorian date -> Kọ́jọ́dá position (same rules as the reference app). */
export function fromGregorian(input) {
  const [y, m, d] = parts(input), cy = cycleYearOf(input);
  const diff = Math.round((utc(y, m, d) - utc(cy, CONFIG.anchorMonth, CONFIG.anchorDay)) / DAY_MS);
  const doy = Math.max(0, Math.min(CONFIG.totalDays - 1, diff));
  return { verified: true, ...describe(doy), cycleYear: cy, gregorian: { year: y, month: m, day: d }, extraDays: Math.max(0, diff - (CONFIG.totalDays - 1)) };
}
/** Position inside a cycle by day number 0..363. */
export function describe(doy) {
  const mi = Math.floor(doy / CONFIG.daysPerMonth), mo = MONTHS[mi];
  return { doy, dayOfYear: doy + 1, monthIndex: mi, monthNumber: mi + 1, month: mo.name, season: mo.season, dayOfMonth: (doy % CONFIG.daysPerMonth) + 1,
    weekOfMonth: Math.floor((doy % CONFIG.daysPerMonth) / CONFIG.daysPerWeek) + 1, weekOfYear: Math.floor(doy / CONFIG.daysPerWeek) + 1,
    dayOfWeek: (doy % CONFIG.daysPerWeek) + 1, quarter: QUARTERS[mi], festival: FESTIVALS[doy] || null };
}
/** Kọ́jọ́dá day number (0..363) in a given cycle -> Gregorian {year, month(0-11), day}. */
export function toGregorianByDoy(cycleYear, doy) {
  if (!Number.isInteger(doy) || doy < 0 || doy >= CONFIG.totalDays) throw new Error('Day must be between 1 and 364');
  return ymd(utc(cycleYear, CONFIG.anchorMonth, CONFIG.anchorDay) + doy * DAY_MS);
}
/** Kọ́jọ́dá month (1-13) and day (1-28) in a cycle -> Gregorian. */
export function toGregorian(cycleYear, monthNumber, dayOfMonth) {
  if (!(monthNumber >= 1 && monthNumber <= 13) || !(dayOfMonth >= 1 && dayOfMonth <= 28)) throw new Error('Month must be 1-13 and day 1-28');
  return toGregorianByDoy(cycleYear, (monthNumber - 1) * CONFIG.daysPerMonth + (dayOfMonth - 1));
}
/** Next festivals on or after a date: [{doy, date, daysAway, festival}] */
export function upcomingFestivals(input, count = 5) {
  const cy = cycleYearOf(input), now = fromGregorian(input), out = [];
  const keys = Object.keys(FESTIVALS).map(Number).sort((a, b) => a - b);
  for (const offset of [0, 1]) for (const k of keys) {
    const c = cy + offset, g = toGregorianByDoy(c, k), [y, m, d] = parts(input);
    const away = Math.round((utc(g.year, g.month, g.day) - utc(y, m, d)) / DAY_MS);
    if (away >= 0) out.push({ doy: k, date: g, daysAway: away, festival: FESTIVALS[k], monthNumber: Math.floor(k / 28) + 1 });
  }
  return out.sort((a, b) => a.daysAway - b.daysAway).slice(0, count);
}
export const gregorianLabel = g => new Date(Date.UTC(g.year, g.month, g.day)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const todayParts = () => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth(), day: n.getDate() }; };
