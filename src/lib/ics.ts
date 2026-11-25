import { lunarYearlyStarts } from './dates';
import type { CalEvent, Repeat } from './types';

const pad = (n: number) => String(n).padStart(2, '0');
const utc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
const dateOnly = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const unesc = (s: string) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
const RRULE: Record<Repeat, string | null> = {
  none: null, daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY',
};

export function toICS(events: CalEvent[]): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Calendar App//KO', 'CALSCALE:GREGORIAN'];
  for (const e of events) {
    const s = new Date(e.start), en = new Date(e.end);
    lines.push('BEGIN:VEVENT', `UID:${e.id}@calendar-app`, `DTSTAMP:${utc(new Date(e.updatedAt))}`);
    if (e.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(s)}`, `DTEND;VALUE=DATE:${dateOnly(new Date(en.getTime() + 86400000))}`);
    } else lines.push(`DTSTART:${utc(s)}`, `DTEND:${utc(en)}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    if (e.notes) lines.push(`DESCRIPTION:${esc(e.notes)}`);
    if (e.lunar && e.repeat === 'yearly') {
      // ICS에는 음력 반복이 없으므로 앞으로 20년치 날짜를 RDATE로 풀어 내보내고, 우리 앱용 X-LUNAR도 함께 기록
      const starts = lunarYearlyStarts(e);
      if (starts.length)
        lines.push(e.allDay ? `RDATE;VALUE=DATE:${starts.map(dateOnly).join(',')}` : `RDATE:${starts.map(utc).join(',')}`);
      lines.push(`X-LUNAR:${e.lunar.month},${e.lunar.day},${e.lunar.leap ? 1 : 0}`);
    } else {
      const r = RRULE[e.repeat];
      if (r) lines.push(`RRULE:${r}`);
    }
    if (e.reminderMinutes !== undefined)
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:-PT${e.reminderMinutes}M`, `DESCRIPTION:${esc(e.title)}`, 'END:VALARM');
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function parseDate(v: string): { d: Date; allDay: boolean } {
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if (!m) return { d: new Date(NaN), allDay: false };
  const [, y, mo, da, h, mi, s, z] = m;
  if (h === undefined) return { d: new Date(+y, +mo - 1, +da), allDay: true };
  return { d: z ? new Date(Date.UTC(+y, +mo - 1, +da, +h, +mi, +s)) : new Date(+y, +mo - 1, +da, +h, +mi, +s), allDay: false };
}

export function fromICS(text: string, profileId: string, newId: () => string): CalEvent[] {
  const lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
  const out: CalEvent[] = [];
  let cur: Record<string, string> | null = null;
  let alarm: number | undefined;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; alarm = undefined; continue; }
    if (line === 'END:VEVENT' && cur) {
      const st = cur.DTSTART && parseDate(cur.DTSTART);
      if (st && !isNaN(st.d.getTime())) {
        const en = cur.DTEND ? parseDate(cur.DTEND) : st;
        let end = isNaN(en.d.getTime()) ? st.d : en.d;
        if (st.allDay && cur.DTEND) end = new Date(end.getTime() - 86400000);
        const lm = /^(\d+),(\d+),([01])$/.exec(cur['X-LUNAR'] ?? '');
        const f = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec(cur.RRULE ?? '')?.[1];
        out.push({
          id: newId(), profileId, title: unesc(cur.SUMMARY ?? '(제목 없음)'),
          start: st.d.toISOString(), end: end.toISOString(), allDay: st.allDay,
          location: cur.LOCATION ? unesc(cur.LOCATION) : undefined,
          notes: cur.DESCRIPTION ? unesc(cur.DESCRIPTION) : undefined,
          repeat: (lm ? 'yearly' : f ? f.toLowerCase() : 'none') as Repeat, reminderMinutes: alarm,
          lunar: lm ? { month: +lm[1], day: +lm[2], leap: lm[3] === '1' } : undefined,
          attendees: [], updatedAt: new Date().toISOString(),
        });
      }
      cur = null; continue;
    }
    if (!cur) continue;
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).split(';')[0];
    const val = line.slice(i + 1);
    if (key === 'TRIGGER') { const m = val.match(/^-PT(\d+)M$/); if (m) alarm = +m[1]; }
    else if (!(key in cur)) cur[key] = val;
  }
  return out;
}
