import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { lunarYearlyStarts } from './dates';
import type { CalEvent, Repeat } from './types';

/**
 * 구글 캘린더 REST API v3 연동.
 * 로그인(OAuth2 + PKCE)은 화면(settings)에서 expo-auth-session으로 수행하고,
 * 여기서는 발급된 액세스 토큰으로 이벤트를 읽고/쓴다.
 */
export const GOOGLE_SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/calendar.events'];
const BASE = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
const TOKEN_KEY = 'calendar_app_google_token';

export interface GToken { accessToken: string; refreshToken?: string; expiresAt: number }

export const saveToken = (t: GToken | null) =>
  t ? SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(t)) : SecureStore.deleteItemAsync(TOKEN_KEY);
export const loadToken = async (): Promise<GToken | null> => {
  const r = await SecureStore.getItemAsync(TOKEN_KEY);
  return r ? JSON.parse(r) : null;
};

const RRULE: Record<Repeat, string[] | undefined> = {
  none: undefined, daily: ['RRULE:FREQ=DAILY'], weekly: ['RRULE:FREQ=WEEKLY'],
  monthly: ['RRULE:FREQ=MONTHLY'], yearly: ['RRULE:FREQ=YEARLY'],
};
const dOnly = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const pad2 = (n: number) => String(n).padStart(2, '0');
const utcStamp = (d: Date) =>
  `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}00Z`;

/** 구글엔 음력 반복이 없어서 앞으로 20년치 양력 날짜를 RDATE 목록으로 보냄 */
function recurrenceOf(e: CalEvent): string[] | undefined {
  if (e.lunar && e.repeat === 'yearly') {
    const starts = lunarYearlyStarts(e);
    if (!starts.length) return undefined;
    return [e.allDay
      ? `RDATE;VALUE=DATE:${starts.map((d) => dOnly(d).replace(/-/g, '')).join(',')}`
      : `RDATE:${starts.map(utcStamp).join(',')}`];
  }
  return RRULE[e.repeat];
}

/** 알림 3상태: 앱에서 고른 알림 / 구글 기본 알림 따름(구글에서 가져온 일정) / 없음 */
function remindersOf(e: CalEvent) {
  if (e.reminderMinutes !== undefined) return { useDefault: false, overrides: [{ method: 'popup', minutes: e.reminderMinutes }] };
  if (e.remindersDefault) return { useDefault: true };
  // "없음"은 반드시 useDefault:false 로 보내야 한다. (생략하거나 true면 구글이 캘린더 기본 알림(보통 30분)을 붙인다)
  return { useDefault: false };
}

/** 앱 일정 → 구글 이벤트 본문 (값이 없는 항목은 키 자체를 생략: PUT으로 보내면 구글에서도 지워진다) */
export function toGoogle(e: CalEvent) {
  const s = new Date(e.start), en = new Date(e.end);
  return {
    summary: e.title,
    location: e.location || undefined,
    description: e.notes || undefined,
    start: e.allDay ? { date: dOnly(s) } : { dateTime: s.toISOString() },
    end: e.allDay ? { date: dOnly(new Date(en.getTime() + 86400000)) } : { dateTime: en.toISOString() },
    recurrence: recurrenceOf(e),
    attendees: e.attendees.length ? e.attendees.map((email) => ({ email })) : undefined,
    reminders: remindersOf(e),
  };
}

const MANAGED = ['summary', 'location', 'description', 'start', 'end', 'recurrence', 'attendees', 'reminders'] as const;

/**
 * 수정용 본문: 구글에 있는 현재 이벤트를 기준으로 앱이 관리하는 항목만 통째로 교체한다.
 * (PATCH는 중첩 객체를 병합해서 start/reminders에 이전 값이 남는 문제가 있어 GET 후 PUT 방식을 쓴다.
 *  화상회의 링크·색상 같은 앱이 모르는 항목은 그대로 보존되고, 기존 참석자의 응답 상태도 유지된다)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildUpdateBody(existing: any, e: CalEvent) {
  const base = { ...existing };
  for (const k of MANAGED) delete base[k];
  const body = { ...base, ...toGoogle(e) };
  if (body.attendees) {
    const prev: { email: string }[] = existing?.attendees ?? [];
    body.attendees = body.attendees.map((a: { email: string }) => prev.find((p) => p.email?.toLowerCase() === a.email.toLowerCase()) ?? a);
  }
  return body;
}

/** 구글이 돌려준 이벤트가 우리가 보낸 내용과 같은지 점검. 다르면 사람이 읽을 수 있는 문제 목록 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function checkPushed(e: CalEvent, r: any): string[] {
  const out: string[] = [];
  if (e.allDay) { if (!r?.start?.date || r?.start?.dateTime) out.push('종일 일정으로 반영되지 않았어요'); }
  else if (!r?.start?.dateTime || r?.start?.date) out.push('시간 일정으로 반영되지 않았어요');
  if (r?.summary !== e.title) out.push('제목이 다르게 반영됐어요');
  const rem = r?.reminders;
  const popup = rem?.overrides?.find((o: { method: string }) => o.method === 'popup');
  if (e.reminderMinutes !== undefined) {
    if (rem?.useDefault || popup?.minutes !== e.reminderMinutes) out.push(`알림이 ${e.reminderMinutes}분 전으로 반영되지 않았어요`);
  } else if (e.remindersDefault) {
    if (!rem?.useDefault) out.push('구글 기본 알림 설정이 반영되지 않았어요');
  } else if (rem?.useDefault || rem?.overrides?.length) out.push('알림 "없음"이 구글에 반영되지 않았어요');
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromGoogle(g: any, profileId: string, id: string): CalEvent | null {
  if (g.status === 'cancelled' || !g.start) return null;
  const allDay = !!g.start.date;
  const s = allDay ? new Date(g.start.date + 'T00:00:00') : new Date(g.start.dateTime);
  let en = allDay ? new Date(g.end.date + 'T00:00:00') : new Date(g.end.dateTime);
  if (allDay) en = new Date(en.getTime() - 86400000);
  const f = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec((g.recurrence ?? []).join(';'))?.[1];
  // useDefault:true 이면 overrides가 남아 있어도 구글은 무시하므로 앱에서도 알림 없음 + 기본 알림 따름으로 취급
  const useDefault = !!g.reminders?.useDefault;
  const popup = useDefault ? undefined : g.reminders?.overrides?.find((o: { method: string }) => o.method === 'popup');
  return {
    id, googleId: g.id, profileId, title: g.summary ?? '(제목 없음)',
    start: s.toISOString(), end: en.toISOString(), allDay,
    location: g.location, notes: g.description,
    repeat: (f ? f.toLowerCase() : 'none') as Repeat,
    reminderMinutes: popup?.minutes,
    remindersDefault: useDefault || undefined,
    attendees: (g.attendees ?? []).map((a: { email: string }) => a.email),
    updatedAt: g.updated ?? new Date().toISOString(),
  };
}

async function call(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** 구글 → 앱: 이전 30일 ~ 이후 365일 (반복 일정은 마스터 1건으로 가져옴) */
/** 동기화로 가져오는 기간. 병합할 때 "이 기간 안인데 구글에 없다 = 구글에서 삭제됨" 판단에도 같은 값을 쓴다. */
export interface PullRange { timeMin: Date; timeMax: Date }
export const pullRange = (now: number = Date.now()): PullRange => ({
  timeMin: new Date(now - 30 * 86400000),
  timeMax: new Date(now + 365 * 86400000),
});

export async function pullEvents(token: string, profileId: string, newId: () => string, existing: CalEvent[], range: PullRange = pullRange()) {
  const params = new URLSearchParams({
    singleEvents: 'false', maxResults: '250',
    timeMin: range.timeMin.toISOString(),
    timeMax: range.timeMax.toISOString(),
  });
  const byGid = new Map(existing.filter((e) => e.googleId).map((e) => [e.googleId!, e]));
  const out: CalEvent[] = [];
  let pageToken: string | undefined;
  do {
    if (pageToken) params.set('pageToken', pageToken);
    const data = await call(token, `${BASE}?${params}`);
    for (const g of data.items ?? []) {
      const prev = byGid.get(g.id);
      const ev = fromGoogle(g, prev?.profileId ?? profileId, prev?.id ?? newId());
      // 음력 반복은 구글에서 RDATE로만 오므로, 앱에 있던 음력 설정을 유지
      if (ev && prev?.lunar) { ev.lunar = prev.lunar; ev.repeat = prev.repeat; }
      // 일정 색상은 구글과 동기화하지 않고 앱에만 보관
      if (ev && prev?.color) ev.color = prev.color;
      if (ev) out.push(ev);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

/** 앱 → 구글 (생성 또는 수정). 참석자가 있으면 구글이 초대 메일을 발송 = 일정 공유. 구글이 돌려준 결과를 점검해 문제 목록도 반환 */
export async function pushEvent(token: string, e: CalEvent): Promise<{ id: string; problems: string[] }> {
  const qs = '?sendUpdates=all';
  const create = async () => {
    const r = await call(token, `${BASE}${qs}`, { method: 'POST', body: JSON.stringify(toGoogle(e)) });
    return { id: r.id as string, problems: checkPushed(e, r) };
  };
  if (!e.googleId) return create();
  let existing;
  try { existing = await call(token, `${BASE}/${e.googleId}`); }
  catch (err) {
    // 구글에서 이미 삭제된 일정이면 새로 만든다
    if (/Google API (404|410)/.test(String(err))) return create();
    throw err;
  }
  const r = await call(token, `${BASE}/${e.googleId}${qs}`, { method: 'PUT', body: JSON.stringify(buildUpdateBody(existing, e)) });
  return { id: r.id as string, problems: checkPushed(e, r) };
}

export const removeEvent = (token: string, googleId: string) =>
  call(token, `${BASE}/${googleId}?sendUpdates=all`, { method: 'DELETE' });

// ---- 토큰 갱신 (액세스 토큰은 1시간짜리라 만료되면 리프레시 토큰으로 새로 받는다)
export const GOOGLE_CLIENT_ID = Platform.select({
  android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
});

/** 유효한 액세스 토큰. 만료됐으면 갱신하고, 불가능하면 null */
export async function freshAccessToken(): Promise<string | null> {
  const t = await loadToken();
  if (!t) return null;
  if (t.expiresAt > Date.now() + 60_000) return t.accessToken;
  if (!t.refreshToken || !GOOGLE_CLIENT_ID) return null;
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: GOOGLE_CLIENT_ID, grant_type: 'refresh_token', refresh_token: t.refreshToken }).toString(),
    });
    if (!res.ok) return null;
    const j = await res.json();
    await saveToken({ accessToken: j.access_token, refreshToken: j.refresh_token ?? t.refreshToken, expiresAt: Date.now() + (j.expires_in ?? 3600) * 1000 });
    return j.access_token;
  } catch {
    return null;
  }
}

/**
 * 동기화 병합: 구글에서 받아온 일정으로 로컬을 갱신하되,
 * 아직 구글에 반영되지 못한(pendingSync) 로컬 변경은 구글의 옛 버전으로 덮어쓰지 않는다.
 *
 * range 를 주면 "구글에서 삭제된 일정"도 반영한다 (다른 기기·AI 비서가 구글에서 지운 경우).
 * 안전을 위해 아래를 모두 만족하는 로컬 일정만 지운다:
 *  - 구글과 연결(googleId)됐고 로컬 수정 대기(pendingSync)가 아님
 *  - 이번에 가져온 목록에 없음 (가져온 목록이 비어 있으면 계정 전환·오류일 수 있어 아무것도 지우지 않음)
 *  - 반복·음력 일정이 아니고, 시작~종료가 가져온 기간 안에 완전히 들어옴 (기간 밖 일정은 목록에 없는 게 정상이라 판단 불가)
 */
export function mergePulled(local: CalEvent[], pulled: CalEvent[], range?: PullRange): CalEvent[] {
  const pendingByG = new Map(local.filter((e) => e.pendingSync && e.googleId).map((e) => [e.googleId!, e]));
  const pulledG = new Set(pulled.map((e) => e.googleId));
  const merged = pulled.map((p) => pendingByG.get(p.googleId!) ?? p);
  const deletedOnGoogle = (e: CalEvent) =>
    !!range && pulled.length > 0 && !!e.googleId && !e.pendingSync && !pulledG.has(e.googleId) &&
    e.repeat === 'none' && !e.lunar &&
    new Date(e.start) >= range.timeMin && new Date(e.end) <= range.timeMax;
  return [...local.filter((e) => (!e.googleId || !pulledG.has(e.googleId)) && !deletedOnGoogle(e)), ...merged];
}
