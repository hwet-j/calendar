import * as SecureStore from 'expo-secure-store';
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

export function toGoogle(e: CalEvent) {
  const s = new Date(e.start), en = new Date(e.end);
  return {
    summary: e.title, location: e.location, description: e.notes,
    start: e.allDay ? { date: dOnly(s) } : { dateTime: s.toISOString() },
    end: e.allDay ? { date: dOnly(new Date(en.getTime() + 86400000)) } : { dateTime: en.toISOString() },
    recurrence: RRULE[e.repeat],
    attendees: e.attendees.length ? e.attendees.map((email) => ({ email })) : undefined,
    reminders: e.reminderMinutes !== undefined
      ? { useDefault: false, overrides: [{ method: 'popup', minutes: e.reminderMinutes }] } : undefined,
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
    const r = await call(token, `${BASE}/${e.googleId}${qs}`, { method: 'PATCH', body: JSON.stringify(toGoogle(e)) });
    return r.id;
  }
  const r = await call(token, `${BASE}${qs}`, { method: 'POST', body: JSON.stringify(toGoogle(e)) });
  return r.id;
}

export const removeEvent = (token: string, googleId: string) =>
  call(token, `${BASE}/${googleId}?sendUpdates=all`, { method: 'DELETE' });
