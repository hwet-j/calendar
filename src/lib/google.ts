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

/**
 * 앱 일정 → 구글 이벤트 본문.
 * patch=true(수정)일 때는 비운 값/바뀐 형식을 구글에 남기지 않도록 null로 명시한다.
 * (PATCH는 필드를 병합하므로, 시간 일정 → 종일로 바꿀 때 `dateTime: null`을 안 보내면
 *  start에 date와 dateTime이 함께 남아 "Invalid start time" 400 오류가 난다)
 */
export function toGoogle(e: CalEvent, patch = false) {
  const s = new Date(e.start), en = new Date(e.end);
  const n = patch ? null : undefined;
  const rec = recurrenceOf(e);
  return {
    summary: e.title,
    location: e.location || n,
    description: e.notes || n,
    start: e.allDay ? { date: dOnly(s), dateTime: n } : { dateTime: s.toISOString(), date: n },
    end: e.allDay ? { date: dOnly(new Date(en.getTime() + 86400000)), dateTime: n } : { dateTime: en.toISOString(), date: n },
    recurrence: rec ?? n,
    attendees: e.attendees.length ? e.attendees.map((email) => ({ email })) : n,
    reminders: e.reminderMinutes !== undefined
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: e.reminderMinutes }] }
      : (patch ? { useDefault: true, overrides: null } : undefined),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromGoogle(g: any, profileId: string, id: string): CalEvent | null {
  if (g.status === 'cancelled' || !g.start) return null;
  const allDay = !!g.start.date;
  const s = allDay ? new Date(g.start.date + 'T00:00:00') : new Date(g.start.dateTime);
  let en = allDay ? new Date(g.end.date + 'T00:00:00') : new Date(g.end.dateTime);
  if (allDay) en = new Date(en.getTime() - 86400000);
  const f = /FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/.exec((g.recurrence ?? []).join(';'))?.[1];
  const popup = g.reminders?.overrides?.find((o: { method: string }) => o.method === 'popup');
  return {
    id, googleId: g.id, profileId, title: g.summary ?? '(제목 없음)',
    start: s.toISOString(), end: en.toISOString(), allDay,
    location: g.location, notes: g.description,
    repeat: (f ? f.toLowerCase() : 'none') as Repeat,
    reminderMinutes: popup?.minutes,
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
export async function pullEvents(token: string, profileId: string, newId: () => string, existing: CalEvent[]) {
  const params = new URLSearchParams({
    singleEvents: 'false', maxResults: '250',
    timeMin: new Date(Date.now() - 30 * 86400000).toISOString(),
    timeMax: new Date(Date.now() + 365 * 86400000).toISOString(),
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

/** 앱 → 구글 (생성 또는 수정). 참석자가 있으면 구글이 초대 메일을 발송 = 일정 공유 */
export async function pushEvent(token: string, e: CalEvent): Promise<string> {
  const qs = '?sendUpdates=all';
  if (e.googleId) {
    const r = await call(token, `${BASE}/${e.googleId}${qs}`, { method: 'PATCH', body: JSON.stringify(toGoogle(e, true)) });
    return r.id;
  }
  const r = await call(token, `${BASE}${qs}`, { method: 'POST', body: JSON.stringify(toGoogle(e)) });
  return r.id;
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
 */
export function mergePulled(local: CalEvent[], pulled: CalEvent[]): CalEvent[] {
  const pendingByG = new Map(local.filter((e) => e.pendingSync && e.googleId).map((e) => [e.googleId!, e]));
  const pulledG = new Set(pulled.map((e) => e.googleId));
  const merged = pulled.map((p) => pendingByG.get(p.googleId!) ?? p);
  return [...local.filter((e) => !e.googleId || !pulledG.has(e.googleId)), ...merged];
}
