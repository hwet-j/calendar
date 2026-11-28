import * as IntentLauncher from 'expo-intent-launcher';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { useEventActions } from '../lib/actions';
import { ASSISTANT_PACKAGE, eventsResult, parseCmd, replyUrl } from '../lib/assistantQuery';
import { dayKey } from '../lib/dates';
import { uid, useStore } from '../lib/store';
import type { CalEvent } from '../lib/types';

/** 처리한 요청 id (같은 요청이 앱 재시작 등으로 다시 오면 무시) */
let lastId = '';

/** 응답은 비서 패키지로만 보낸다 (명시적 인텐트). 비서가 없으면 조용히 무시. 비서 화면이 앞으로 나오므로 사용자는 자동으로 비서로 돌아간다 */
const reply = (id: string, payload: unknown) =>
  IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: replyUrl(id, payload),
    packageName: ASSISTANT_PACKAGE,
    flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK
  }).catch(() => {});

/**
 * calendarapp://assistant?cmd=… — AI 비서의 요청.
 *  · show: 날짜 화면 열기 · query: 일정 조회(읽기 전용)
 *  · add·update·delete: 일정 한 건을 **바로 등록·수정·삭제** (비서 화면에서 사용자가 이미 확인한 뒤에만 보낸다). 이 앱의 구글 연결을 그대로 쓴다.
 *    update·delete 는 일정 조회 결과의 id 로 가리키며, 반복·음력 일정은 거부한다.
 */
export default function Assistant() {
  const { ready, state } = useStore();
  const { add, remove } = useEventActions();
  const { cmd } = useLocalSearchParams<{ cmd?: string }>();
  const t = useTheme();
  const done = useRef(false);

  useEffect(() => {
    if (!ready || done.current) return;
    done.current = true;
    const c = parseCmd(Array.isArray(cmd) ? cmd[0] : cmd);
    if (typeof c === 'string') { router.replace('/'); return; }
    if (c.id === lastId) { router.replace('/'); return; }
    lastId = c.id;
    if (c.op === 'show') { router.replace({ pathname: '/', params: { date: dayKey(c.date) } }); return; }
    if (c.op === 'update' || c.op === 'delete') {
      (async () => {
        try {
          const cur = state.events.find((e) => e.id === c.eventId);
          if (!cur) { await reply(c.id, { ok: false, error: '그 일정을 찾을 수 없어요. 일정을 다시 조회해서 id 를 확인해 주세요.' }); return; }
          // 반복·음력 일정은 한 회차만 바꾸는 규칙이 복잡해 앱 화면에서 직접 하도록 한다
          if (cur.repeat !== 'none' || cur.lunar) { await reply(c.id, { ok: false, error: '반복·음력 일정은 캘린더 앱에서 직접 수정해 주세요.' }); return; }
          if (c.op === 'delete') {
            const r = await remove(cur);
            await reply(c.id, r.ok ? { ok: true, what: 'delete', data: { id: cur.id, title: cur.title, deleted: true, googleRemoved: r.googleRemoved } } : { ok: false, error: '구글 캘린더에서 지우지 못해 기기 일정도 그대로 뒀어요. 구글 연결을 확인해 주세요.' });
            return;
          }
          const p = c.patch;
          const allDay = p.allDay ?? cur.allDay;
          const oldStart = new Date(cur.start);
          const oldEnd = new Date(cur.end);
          let start = p.start ?? oldStart;
          let end = p.end ?? (p.start ? new Date(p.start.getTime() + (oldEnd.getTime() - oldStart.getTime())) : oldEnd);
          if (allDay) { start = new Date(start.getFullYear(), start.getMonth(), start.getDate()); end = new Date(end.getFullYear(), end.getMonth(), end.getDate()); }
          else if (!p.end && !p.start && p.allDay === false) end = new Date(start.getTime() + 3_600_000);
          if (end < start) { await reply(c.id, { ok: false, error: '끝이 시작보다 앞서요' }); return; }
          const next: CalEvent = {
            ...cur, title: p.title ?? cur.title, allDay, start: start.toISOString(), end: end.toISOString(),
            location: p.clearLocation ? undefined : p.location ?? cur.location, notes: p.clearNotes ? undefined : p.notes ?? cur.notes,
            updatedAt: new Date().toISOString(),
          };
          const r = await add(next);
          await reply(c.id, { ok: true, what: 'update', data: { id: next.id, title: next.title, start: next.start, end: next.end, allDay: next.allDay, googleSynced: r.googleSynced } });
        } catch (e) {
          await reply(c.id, { ok: false, error: e instanceof Error ? e.message : '일정을 처리하지 못했어요' });
        }
        router.replace('/');
      })();
      return;
    }
    if (c.op === 'add') {
      (async () => {
        try {
          // 같은 제목·같은 시작 일정이 이미 있으면 새로 만들지 않는다 (비서가 같은 요청을 다시 보낸 경우)
          const same = state.events.find((e) => e.title.trim().toLowerCase() === c.title.toLowerCase() && new Date(e.start).getTime() === c.start.getTime());
          if (same) {
            await reply(c.id, { ok: true, what: 'add', data: { id: same.id, title: same.title, start: same.start, end: same.end, allDay: same.allDay, duplicate: true, googleSynced: null } });
            router.replace({ pathname: '/', params: { date: dayKey(c.start) } });
            return;
          }
          const ev: CalEvent = {
            id: uid(), profileId: state.activeProfileId ?? state.profiles[0].id, title: c.title, allDay: c.allDay, repeat: 'none',
            reminderMinutes: 10, attendees: [], start: c.start.toISOString(), end: c.end.toISOString(),
            ...(c.location ? { location: c.location } : {}), ...(c.notes ? { notes: c.notes } : {}), updatedAt: new Date().toISOString(),
          };
          const r = await add(ev);
          await reply(c.id, { ok: true, what: 'add', data: { id: ev.id, title: ev.title, start: ev.start, end: ev.end, allDay: ev.allDay, duplicate: false, googleSynced: r.googleSynced } });
        } catch (e) {
          await reply(c.id, { ok: false, error: e instanceof Error ? e.message : '일정을 저장하지 못했어요' });
        }
        router.replace({ pathname: '/', params: { date: dayKey(c.start) } });
      })();
      return;
    }
    reply(c.id, { ok: true, what: c.what, data: eventsResult(state, c.from, c.to) });
    router.replace('/');
  }, [ready, cmd, state, add, remove]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, gap: 12 }}>
      <ActivityIndicator color={t.primary} />
      <Text style={{ color: t.sub }}>비서에 전달하는 중…</Text>
    </View>
  );
}
