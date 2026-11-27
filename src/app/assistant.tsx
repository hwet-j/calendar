import * as IntentLauncher from 'expo-intent-launcher';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '../components/theme';
import { ASSISTANT_PACKAGE, eventsResult, parseCmd, replyUrl } from '../lib/assistantQuery';
import { dayKey } from '../lib/dates';
import { useStore } from '../lib/store';

/** 처리한 요청 id (같은 요청이 앱 재시작 등으로 다시 오면 무시) */
let lastId = '';

/** calendarapp://assistant?cmd=… — AI 비서의 조회/화면 열기 요청. 자동 저장·수정은 없다. */
export default function Assistant() {
  const { ready, state } = useStore();
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
    // 응답은 비서 패키지로만 보낸다 (명시적 인텐트). 비서가 없으면 조용히 무시
    IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: replyUrl(c.id, { ok: true, what: c.what, data: eventsResult(state, c.from, c.to) }),
      packageName: ASSISTANT_PACKAGE,
      flags: 0x10000000, // FLAG_ACTIVITY_NEW_TASK
    }).catch(() => {});
    router.replace('/');
  }, [ready, cmd, state]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, gap: 12 }}>
      <ActivityIndicator color={t.primary} />
      <Text style={{ color: t.sub }}>비서에 전달하는 중…</Text>
    </View>
  );
}
