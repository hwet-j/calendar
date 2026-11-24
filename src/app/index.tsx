import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { R, Theme, useTheme } from '../components/theme';
import { dayKey, expand, fmtTime, monthGrid, onDay, sameDay } from '../lib/dates';
import { profileOf } from '../lib/filter';
import { useStore } from '../lib/store';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export default function Home() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { state, shown, setActive } = useStore();
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [sel, setSel] = useState(now);

  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const occ = useMemo(() => expand(shown, grid[0], new Date(grid[41].getTime() + 86400000)), [shown, grid]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof occ>();
    for (const d of grid) m.set(dayKey(d), onDay(occ, d));
    return m;
  }, [occ, grid]);
  const list = byDay.get(dayKey(sel)) ?? onDay(expand(shown, sel, new Date(sel.getTime() + 86400000)), sel);

  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const goToday = () => { setCursor(new Date(now.getFullYear(), now.getMonth(), 1)); setSel(now); };
  const tap = () => Haptics.selectionAsync().catch(() => {});
  const isThisMonth = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth();

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <View>
          <Text style={s.year}>{cursor.getFullYear()}</Text>
          <Text style={s.month}>{cursor.getMonth() + 1}월</Text>
        </View>
        <View style={s.headerRight}>
          <IconBtn s={s} t={t} name="chevron-back" onPress={() => move(-1)} label="이전 달" />
          <IconBtn s={s} t={t} name="chevron-forward" onPress={() => move(1)} label="다음 달" />
          {!(isThisMonth && sameDay(sel, now)) && (
            <Pressable style={s.todayBtn} onPress={goToday} accessibilityRole="button" accessibilityLabel="오늘로 이동">
              <Text style={s.todayT}>오늘</Text>
            </Pressable>
          )}
          <IconBtn s={s} t={t} name="settings-outline" onPress={() => router.push('/settings')} label="설정" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={s.chipsContent}>
        <Chip s={s} t={t} label="전체" on={state.activeProfileId === null} onPress={() => { tap(); setActive(null); }} />
        {state.profiles.map((p) => (
          <Chip key={p.id} s={s} t={t} label={p.name} color={p.color} on={state.activeProfileId === p.id}
            onPress={() => { tap(); setActive(p.id); }} />
        ))}
        <Pressable style={s.manage} onPress={() => router.push('/profiles')} accessibilityLabel="프로필 관리">
          <Ionicons name="add" size={16} color={t.sub} />
          <Text style={s.manageT}>프로필</Text>
        </Pressable>
      </ScrollView>

      <View style={s.calendar}>
        <View style={s.row}>
          {DOW.map((d, i) => (
            <Text key={d} style={[s.dow, i === 0 && { color: t.sun }, i === 6 && { color: t.sat }]}>{d}</Text>
          ))}
        </View>
        <View style={s.grid}>
          {grid.map((d) => {
            const items = byDay.get(dayKey(d)) ?? [];
            const out = d.getMonth() !== cursor.getMonth();
            const isSel = sameDay(d, sel);
            const isToday = sameDay(d, now);
            const colors = [...new Set(items.map((o) => profileOf(state.profiles, o.event.profileId).color))].slice(0, 3);
            return (
              <Pressable key={d.toISOString()} style={s.cell} onPress={() => { tap(); setSel(d); }}
                accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일, 일정 ${items.length}개`}>
                <View style={[s.num, isSel && { backgroundColor: t.primary }, !isSel && isToday && { backgroundColor: t.primarySoft }]}>
                  <Text style={[
                    s.numT,
                    d.getDay() === 0 && { color: t.sun }, d.getDay() === 6 && { color: t.sat },
                    out && { color: t.faint },
                    (isToday && !isSel) && { color: t.primary, fontWeight: '800' },
                    isSel && { color: '#fff', fontWeight: '800' },
                  ]}>{d.getDate()}</Text>
                </View>
                <View style={s.dots}>
                  {colors.map((c) => <View key={c} style={[s.dot, { backgroundColor: c }, out && { opacity: 0.4 }]} />)}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={s.agendaHead}>
        <Text style={s.agendaTitle}>{sel.getMonth() + 1}월 {sel.getDate()}일 {DOW[sel.getDay()]}요일</Text>
        {list.length > 0 && <Text style={s.count}>{list.length}개</Text>}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96, gap: 10 }}>
        {list.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="calendar-clear-outline" size={36} color={t.faint} />
            <Text style={s.emptyT}>이 날은 일정이 없어요</Text>
            <Text style={s.emptyS}>오른쪽 아래 + 버튼으로 추가해 보세요</Text>
          </View>
        )}
        {list.map((o, i) => {
          const p = profileOf(state.profiles, o.event.profileId);
          const multi = !sameDay(o.start, o.end);
          return (
            <Pressable key={`${o.event.id}-${i}`} style={s.card} onPress={() => router.push(`/event/${o.event.id}`)}
              accessibilityRole="button" accessibilityLabel={o.event.title}>
              <View style={s.time}>
                {o.event.allDay || (multi && !sameDay(o.start, sel)) ? (
                  <Text style={s.timeAll}>종일</Text>
                ) : (
                  <>
                    <Text style={s.timeT}>{fmtTime(o.start)}</Text>
                    <Text style={s.timeS}>{fmtTime(o.end)}</Text>
                  </>
                )}
              </View>
              <View style={[s.bar, { backgroundColor: p.color }]} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={s.itemT} numberOfLines={1}>{o.event.title}</Text>
                <View style={s.meta}>
                  <View style={[s.pdot, { backgroundColor: p.color }]} />
                  <Text style={s.metaT}>{p.name}</Text>
                  {!!o.event.location && (<><Ionicons name="location-outline" size={12} color={t.sub} /><Text style={s.metaT} numberOfLines={1}>{o.event.location}</Text></>)}
                  {o.event.repeat !== 'none' && <Ionicons name="repeat" size={12} color={t.sub} />}
                  {o.event.reminderMinutes !== undefined && <Ionicons name="notifications-outline" size={12} color={t.sub} />}
                  {o.event.attendees.length > 0 && (<><Ionicons name="people-outline" size={13} color={t.sub} /><Text style={s.metaT}>{o.event.attendees.length}</Text></>)}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        style={[s.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: sel.toISOString() } })}
        accessibilityRole="button" accessibilityLabel="일정 추가"
      >
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

function IconBtn({ s, t, name, onPress, label }: { s: ReturnType<typeof styles>; t: Theme; name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  return (
    <Pressable style={s.iconBtn} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={name} size={22} color={t.text} />
    </Pressable>
  );
}

function Chip({ s, t, label, color, on, onPress }: { s: ReturnType<typeof styles>; t: Theme; label: string; color?: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: t.text, borderColor: t.text }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {color && <View style={[s.chipDot, { backgroundColor: color }]} />}
      <Text style={[s.chipT, on && { color: t.bg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: t.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  year: { fontSize: 13, fontWeight: '600', color: t.sub },
  month: { fontSize: 34, fontWeight: '800', color: t.text, letterSpacing: -0.5, lineHeight: 40 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  todayBtn: { paddingHorizontal: 12, height: 30, borderRadius: R.pill, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  todayT: { color: t.primary, fontWeight: '700', fontSize: 13 },
  chips: { flexGrow: 0 },
  chipsContent: { gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 34, borderRadius: R.pill, backgroundColor: t.card, borderWidth: 1, borderColor: t.line },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipT: { color: t.text, fontWeight: '600', fontSize: 14 },
  manage: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, height: 34, borderRadius: R.pill, borderWidth: 1, borderColor: t.line, borderStyle: 'dashed' },
  manageT: { color: t.sub, fontSize: 13, fontWeight: '600' },
  calendar: { marginHorizontal: 16, backgroundColor: t.card, borderRadius: R.lg, paddingHorizontal: 6, paddingTop: 10, paddingBottom: 6, boxShadow: t.shadow },
  row: { flexDirection: 'row' },
  dow: { flex: 1, textAlign: 'center', color: t.sub, fontSize: 12, fontWeight: '600', paddingBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', paddingTop: 2 },
  num: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  numT: { fontSize: 15, color: t.text, fontWeight: '500' },
  dots: { flexDirection: 'row', gap: 3, marginTop: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  agendaHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 10 },
  agendaTitle: { fontSize: 17, fontWeight: '800', color: t.text },
  count: { fontSize: 12, fontWeight: '700', color: t.primary, backgroundColor: t.primarySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: R.pill, overflow: 'hidden' },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 6 },
  emptyT: { fontSize: 15, fontWeight: '700', color: t.text, marginTop: 4 },
  emptyS: { fontSize: 13, color: t.sub },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.card, borderRadius: R.md, padding: 14, boxShadow: t.shadow },
  time: { width: 44, alignItems: 'center' },
  timeT: { fontSize: 14, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] },
  timeS: { fontSize: 12, color: t.sub, marginTop: 2, fontVariant: ['tabular-nums'] },
  timeAll: { fontSize: 12, fontWeight: '700', color: t.sub },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  itemT: { fontSize: 16, fontWeight: '700', color: t.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  pdot: { width: 6, height: 6, borderRadius: 3 },
  metaT: { fontSize: 12, color: t.sub, marginRight: 4, flexShrink: 1 },
  fab: { position: 'absolute', right: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', boxShadow: t.fabShadow },
});
