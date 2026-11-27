import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../components/ui';
import { R, Theme, useTheme } from '../../components/theme';
import { useEventActions } from '../../lib/actions';
import { asOccurrence, daysBetween } from '../../lib/copy';
import { dayKey, fmtTime, monthGrid, sameDay, startOfDay } from '../../lib/dates';
import { useStore } from '../../lib/store';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_PICK = 60;

/** 한 일정을 여러 날짜에 한꺼번에 복사 (불규칙하게 되풀이되는 일정용) */
export default function CopyScreen() {
  const { ready } = useStore();
  return ready ? <CopyForm /> : null;
}

function CopyForm() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id, start } = useLocalSearchParams<{ id: string; start?: string }>();
  const { state } = useStore();
  const { copyOn } = useEventActions();
  const found = state.events.find((e) => e.id === id);
  // 반복 일정에서 특정 회차를 길게 눌러 온 경우, 그 회차의 날짜·시각을 기준으로 복사
  const src = useMemo(() => {
    if (!found) return null;
    const d = start ? new Date(start) : null;
    return d && !isNaN(d.getTime()) ? asOccurrence(found, d) : found;
  }, [found, start]);

  const srcDay = src ? startOfDay(new Date(src.start)) : new Date();
  const [cursor, setCursor] = useState(() => new Date(srcDay.getFullYear(), srcDay.getMonth(), 1));
  const [picked, setPicked] = useState<Map<string, Date>>(new Map());
  const [busy, setBusy] = useState(false);

  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const toggle = (d: Date) => {
    Haptics.selectionAsync().catch(() => {});
    const k = dayKey(d);
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(k)) n.delete(k);
      else if (n.size >= MAX_PICK) Alert.alert(`한 번에 ${MAX_PICK}일까지만 복사할 수 있어요`);
      else n.set(k, d);
      return n;
    });
  };

  if (!src) return <View style={s.root}><Stack.Screen options={{ title: '일정 복사' }} /><Text style={s.empty}>일정을 찾을 수 없어요</Text></View>;

  const dates = [...picked.values()].sort((a, b) => a.getTime() - b.getTime());
  const sd = new Date(src.start), ed = new Date(src.end);
  const when = src.allDay ? '종일' : `${fmtTime(sd)} – ${fmtTime(ed)}`;
  const special = src.repeat !== 'none' || !!src.lunar;

  const run = async () => {
    if (busy || dates.length === 0) return;
    setBusy(true);
    try {
      const n = await copyOn(src, dates.map((d) => daysBetween(srcDay, d)));
      Alert.alert('복사했어요', `${n}개의 일정을 만들었어요.`, [{ text: '확인', onPress: () => router.dismissTo('/') }]);
    } finally { setBusy(false); }
  };

  return (
    <View style={s.root}>
      <Stack.Screen options={{ title: '일정 복사' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
        <View style={s.src}>
          <View style={[s.srcBar, { backgroundColor: src.color ?? state.profiles.find((p) => p.id === src.profileId)?.color ?? t.primary }]} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.srcT} numberOfLines={1}>{src.title}</Text>
            <Text style={s.srcS}>{when} · 같은 시간으로 복사돼요</Text>
          </View>
        </View>
        <Text style={s.hint}>
          복사할 날짜를 모두 눌러 고르세요. 날짜가 규칙적이지 않아도 한 번에 만들 수 있어요.
          {special ? '\n반복·음력 설정은 복사본에 적용되지 않고, 각각 한 번짜리 일정이 돼요.' : ''}
          {src.attendees.length > 0 ? '\n참석자(초대)는 복사본에 넣지 않아요.' : ''}
        </Text>

        <View style={s.card}>
          <View style={s.nav}>
            <Pressable onPress={() => move(-1)} hitSlop={10} style={s.navBtn} accessibilityRole="button" accessibilityLabel="이전 달">
              <Ionicons name="chevron-back" size={22} color={t.text} />
            </Pressable>
            <Text style={s.navT}>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</Text>
            <Pressable onPress={() => move(1)} hitSlop={10} style={s.navBtn} accessibilityRole="button" accessibilityLabel="다음 달">
              <Ionicons name="chevron-forward" size={22} color={t.text} />
            </Pressable>
          </View>
          <View style={s.row}>
            {DOW.map((d, i) => <Text key={d} style={[s.dow, i === 0 && { color: t.sun }, i === 6 && { color: t.sat }]}>{d}</Text>)}
          </View>
          {Array.from({ length: 6 }, (_, w) => (
            <View key={w} style={s.row}>
              {grid.slice(w * 7, w * 7 + 7).map((d) => {
                const on = picked.has(dayKey(d));
                const out = d.getMonth() !== cursor.getMonth();
                const isSrc = sameDay(d, srcDay);
                return (
                  <Pressable key={dayKey(d)} style={s.cell} onPress={() => toggle(d)} accessibilityRole="button"
                    accessibilityState={{ selected: on }} accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일${isSrc ? ' (원본)' : ''}`}>
                    <View style={[s.day, on && { backgroundColor: t.primary }, !on && isSrc && { borderWidth: 1.5, borderColor: t.primary }]}>
                      <Text style={[s.dayT, d.getDay() === 0 && { color: t.sun }, d.getDay() === 6 && { color: t.sat }, out && { color: t.faint }, on && { color: '#fff', fontWeight: '800' }]}>
                        {d.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {dates.length > 0 && (
          <View style={s.chips}>
            {dates.map((d) => (
              <Pressable key={dayKey(d)} style={s.chip} onPress={() => toggle(d)} accessibilityRole="button" accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일 선택 해제`}>
                <Text style={s.chipT}>{d.getMonth() + 1}/{d.getDate()} ({DOW[d.getDay()]})</Text>
                <Ionicons name="close" size={14} color={t.sub} />
              </Pressable>
            ))}
          </View>
        )}

        <Button text={busy ? '복사 중…' : dates.length ? `${dates.length}일에 복사` : '날짜를 선택하세요'} icon="copy-outline" onPress={run} disabled={busy || dates.length === 0} />
      </ScrollView>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  empty: { textAlign: 'center', color: t.sub, marginTop: 60 },
  src: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: R.md, padding: 14, boxShadow: t.shadow },
  srcBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  srcT: { fontSize: 17, fontWeight: '800', color: t.text },
  srcS: { fontSize: 13, color: t.sub },
  hint: { fontSize: 13, color: t.sub, lineHeight: 19, marginHorizontal: 4 },
  card: { backgroundColor: t.card, borderRadius: R.lg, padding: 10, boxShadow: t.shadow },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navT: { fontSize: 17, fontWeight: '800', color: t.text },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', color: t.sub, fontSize: 12, fontWeight: '600', paddingBottom: 6 },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 3 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayT: { fontSize: 15, color: t.text, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: R.pill, backgroundColor: t.primarySoft },
  chipT: { fontSize: 13, fontWeight: '700', color: t.primary },
});
