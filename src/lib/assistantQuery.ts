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
  | { op: 'show'; id: string; date: Date };

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
  return '지원하지 않는 요청이에요';
}

/** [from, to] (양 끝 날짜 포함) 에 걸치는 일정. 보이는 프로필만, 반복은 회차로 펼침 */
export function eventsResult(state: AppState, from: Date, to: Date) {
  const hidden = new Set(state.profiles.filter((p) => !p.visible).map((p) => p.id));
  const names = new Map(state.profiles.map((p) => [p.id, p.name]));
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  const occ = expand(state.events.filter((e) => !hidden.has(e.profileId)), from, end)
    .filter((o) => o.start < end && (o.end > from || o.start >= from));
  const list = occ.slice(0, MAX_ITEMS).map((o) => {
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
  return { from: ymd(from), to: ymd(to), count: occ.length, truncated: occ.length > MAX_ITEMS, events: list };
}

/** 비서에게 돌려줄 주소. data 는 JSON 문자열 */
export function replyUrl(id: string, payload: unknown): string {
  return `hwetassistant://result?id=${encodeURIComponent(id)}&app=calendar&data=${encodeURIComponent(JSON.stringify(payload))}`;
}
