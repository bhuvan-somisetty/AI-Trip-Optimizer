/**
 * Festival and holiday rush periods in India, when fares (especially direct flights) climb.
 *
 * Festival dates follow the lunar calendar, so they are listed per year: 2027 dates are from
 * timeanddate.com's India holiday list (checked 23 Nov 2026). Each window starts a few days
 * before the festival, when people travel home, and ends a few days after, when they return.
 * Christmas to New Year and the summer school holidays repeat every year. Nothing here changes a
 * search: it only explains why fares are high and suggests the cheaper-routes search.
 */

export type Festival = {
  name: string;
  /** first and last day of the rush, YYYY-MM-DD */
  from: string;
  to: string;
  /** where the rush is strongest, when it is regional */
  region?: string;
};

const DATED: Festival[] = [
  { name: "Makar Sankranti and Pongal", from: "2027-01-10", to: "2027-01-18", region: "Tamil Nadu, Andhra Pradesh, Karnataka and Gujarat" },
  { name: "Eid ul-Fitr", from: "2027-03-07", to: "2027-03-12" },
  { name: "Holi", from: "2027-03-18", to: "2027-03-25", region: "North India" },
  { name: "Easter weekend", from: "2027-03-26", to: "2027-03-28" },
  { name: "Independence Day and Raksha Bandhan", from: "2027-08-13", to: "2027-08-18" },
  { name: "Ganesh Chaturthi", from: "2027-09-01", to: "2027-09-07", region: "Maharashtra and Goa" },
  { name: "Onam", from: "2027-09-08", to: "2027-09-14", region: "Kerala" },
  { name: "Durga Puja and Dussehra", from: "2027-10-03", to: "2027-10-11", region: "West Bengal and East India" },
  { name: "Diwali and Chhath Puja", from: "2027-10-24", to: "2027-11-06" },
];

/** Rush periods that repeat every year, as MM-DD (a window may run into the next year). */
const YEARLY: { name: string; from: string; to: string }[] = [
  { name: "Christmas and New Year", from: "12-20", to: "01-04" },
  { name: "Summer school holidays", from: "05-01", to: "06-15" },
];

/** The rush period a day falls in, festivals before the yearly holidays; null on an ordinary day. */
export function festivalOn(day: string): Festival | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const dated = DATED.find((f) => f.from <= day && day <= f.to);
  if (dated) return dated;
  const year = Number(day.slice(0, 4));
  const md = day.slice(5);
  for (const y of YEARLY) {
    if (y.from <= y.to ? y.from <= md && md <= y.to : md >= y.from || md <= y.to) {
      // A window across New Year belongs to the year it started in.
      const start = y.from <= y.to || md >= y.from ? year : year - 1;
      const end = y.from <= y.to ? start : start + 1;
      return { name: y.name, from: `${start}-${y.from}`, to: `${end}-${y.to}` };
    }
  }
  return null;
}

/** The first rush period touching a trip from `start` to `end` (inclusive), if any. */
export function festivalDuring(start: string, end?: string | null): Festival | null {
  if (!end || end < start) return festivalOn(start);
  const day = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  for (let i = 0; day <= last && i < 60; i++, day.setUTCDate(day.getUTCDate() + 1)) {
    const found = festivalOn(day.toISOString().slice(0, 10));
    if (found) return found;
  }
  return null;
}
