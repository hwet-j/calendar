import { expand, startOfDay } from './dates';
import type { AppState } from './types';

/**
 * AI 비서 앱(com.hwetj.assistant) 연동: calendarapp://assistant?cmd=<URL인코딩 JSON>
 *   {v:1, id, ts(ms), op:'query', what:'events', from?:'YYYY-MM-DD', to?:'YYYY-MM-DD'}  → 일정 목록을 비서에게 돌려줌
 *   {v:1, id, ts(ms), op:'show', date:'YYYY-MM-DD'}                                    → 그 날짜 화면 열기
 * 조회는 데이터를 바꾸지 않는다. 응답에는 제목·시간·장소·프로필만 담고, 메모·참석자 이메일은 담지 않는다.
 * 응답은 항상 비서 패키지로만 보낸다 (요청이 응답 대상을 정할 수 없음).
 */
export const ASSISTANT_PACKAGE = 'com.hwetj.assistant';
export const TTL_MS = 10 * 60 * 1000;
const MAX_ITEMS = 150;
const MAX_SPAN_DAYS = 92;

export type AssistantCmd =
  | { op: 'query'; id: string; what: 'events'; from: Date; to: Date }
  | { op: 'show'; id: string; date: Date }
  | { op: 'add'; id: string; title: string; start: Date; end: Date; allDay: boolean; location?: string; notes?: string };

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymdhm = (d: Date) => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function parseYmd(v: unknown): Date | null {
  if (typeof v !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  if (y < 2000 || y > 2100) return null;
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d ? dt : null;
}

/** 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm(:ss)' (현지 시각). 그 밖의 형식은 null */
function parseWhen(v: unknown): { d: Date; dateOnly: boolean } | null {
  if (typeof v !== 'string') return null;
  const day = parseYmd(v);
  if (day) return { d: day, dateOnly: true };
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(v);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  const ok = +m[1] >= 2000 && +m[1] <= 2100 && +m[4] < 24 && +m[5] < 60 && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  return ok ? { d, dateOnly: false } : null;
}

const clip = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/** 바깥에서 온 JSON 문자열을 검증. 문제가 있으면 사람이 읽을 오류 문자열 */
export function parseCmd(raw: unknown, now: number = Date.now()): AssistantCmd | string {
  if (typeof raw !== 'string' || raw.length > 4000) return '요청 형식이 올바르지 않아요';
  let j: any;
  try { j = JSON.parse(raw); } catch { return '요청을 해석할 수 없어요'; }
  if (!j || typeof j !== 'object' || j.v !== 1) return '지원하지 않는 요청 버전이에요';
  if (typeof j.id !== 'string' || !/^[\w-]{1,64}$/.test(j.id)) return '요청 id 가 올바르지 않아요';
  if (typeof j.ts !== 'number' || Math.abs(now - j.ts) > TTL_MS) return '오래된 요청이에요';
  if (j.op === 'show') {
    const date = parseYmd(j.date);
    return date ? { op: 'show', id: j.id, date } : 'date(YYYY-MM-DD) 가 필요해요';
  }
  if (j.op === 'query' && j.what === 'events') {
    const today = startOfDay(new Date(now));
    const from = j.from === undefined ? today : parseYmd(j.from);
    const to = j.to === undefined ? (from ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + 14) : null) : parseYmd(j.to);
    if (!from || !to) return 'from/to 는 YYYY-MM-DD 형식이어야 해요';
    if (to < from) return 'to 가 from 보다 앞서요';
    const span = Math.round((to.getTime() - from.getTime()) / 86400000);
    if (span > MAX_SPAN_DAYS) return `한 번에 ${MAX_SPAN_DAYS}일까지만 조회할 수 있어요`;
    return { op: 'query', id: j.id, what: 'events', from, to };
  }
  if (j.op === 'add') {
    const title = clip(j.title, 200);
    if (!title) return 'title 이 필요해요';
    const st = parseWhen(j.start);
    if (!st) return 'start 는 YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm 형식이어야 해요';
    const allDay = j.allDay === true || (j.allDay == null && st.dateOnly);
    const en = j.end == null ? null : parseWhen(j.end);
    if (j.end != null && !en) return 'end 는 YYYY-MM-DD 또는 YYYY-MM-DDTHH:mm 형식이어야 해요';
    const start = allDay ? startOfDay(st.d) : st.d;
    const end = allDay ? startOfDay(en?.d ?? st.d) : (en?.d ?? new Date(st.d.getTime() + 3_600_000));
    if (end < start) return 'end 가 start 보다 앞서요';
    return { op: 'add', id: j.id, title, start, end, allDay, location: clip(j.location, 200), notes: clip(j.notes, 2000) };
  }
  return '지원하지 않는 요청이에요';
}

/** [from, to] (양 끝 날짜 포함) 에 걸치는 일정을 비서에게 줄 모양으로. 보이는 프로필만, 반복은 회차로 펼침 */
function collect(state: AppState, from: Date, to: Date, cap: number) {
  const hidden = new Set(state.profiles.filter((p) => !p.visible).map((p) => p.id));
  const names = new Map(state.profiles.map((p) => [p.id, p.name]));
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  const occ = expand(state.events.filter((e) => !hidden.has(e.profileId)), from, end)
    .filter((o) => o.start < end && (o.end > from || o.start >= from));
  const events = occ.slice(0, cap).map((o) => {
    const e = o.event;
    // 종일 일정의 종료는 (구글 방식) 다음 날 00:00 이라 마지막 날로 돌려줌
    const last = e.allDay && o.end > o.start ? new Date(o.end.getFullYear(), o.end.getMonth(), o.end.getDate() - 1) : o.end;
    return {
      id: e.id, title: e.title, allDay: e.allDay,
      start: e.allDay ? ymd(o.start) : ymdhm(o.start),
      end: e.allDay ? ymd(last < o.start ? o.start : last) : ymdhm(o.end),
      ...(e.location ? { location: e.location } : {}),
      profile: names.get(e.profileId) ?? '',
      ...(e.repeat !== 'none' ? { repeat: e.repeat } : {}),
    };
  });
  return { count: occ.length, truncated: occ.length > cap, events };
}

export function eventsResult(state: AppState, from: Date, to: Date) {
  const r = collect(state, from, to, MAX_ITEMS);
  return { from: ymd(from), to: ymd(to), ...r };
}

/**
 * 백그라운드 읽기용 스냅샷 (ContentProvider 가 파일로 제공). 앱이 닫혀 있어도 비서가 읽을 수 있다.
 * 창: 오늘 31일 전 ~ 400일 후. 메모·참석자는 담지 않는다. 일정이 바뀔 때·앱이 앞으로 올 때마다 다시 쓴다.
 */
export const SNAPSHOT_PAST_DAYS = 31;
export const SNAPSHOT_FUTURE_DAYS = 400;
export const SNAPSHOT_CAP = 1500;

export function buildSnapshot(state: AppState, now: Date = new Date()) {
  const today = startOfDay(now);
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - SNAPSHOT_PAST_DAYS);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + SNAPSHOT_FUTURE_DAYS);
  const r = collect(state, from, to, SNAPSHOT_CAP);
  return { v: 1 as const, app: 'calendar' as const, ts: now.getTime(), from: ymd(from), to: ymd(to), truncated: r.truncated, events: r.events };
}

/** 비서에게 돌려줄 주소. data 는 JSON 문자열 */
export function replyUrl(id: string, payload: unknown): string {
  return `hwetassistant://result?id=${encodeURIComponent(id)}&app=calendar&data=${encodeURIComponent(JSON.stringify(payload))}`;
}
