import { Link, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { C } from '../components/theme';
import { dayKey, expand, fmtTime, monthGrid, onDay, sameDay } from '../lib/dates';
import { profileOf } from '../lib/filter';
import { useStore } from '../lib/store';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];

export default function Home() {
  const { state, shown, setActive } = useStore();
  const [cursor, setCursor] = useState(() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), 1); });
  const [sel, setSel] = useState(new Date());
  const grid = useMemo(() => monthGrid(cursor.getFullYear(), cursor.getMonth()), [cursor]);
  const occ = useMemo(() => expand(shown, grid[0], new Date(grid[41].getTime() + 86400000)), [shown, grid]);
  const byDay = useMemo(() => {
    const m = new Map<string, typeof occ>();
    for (const d of grid) m.set(dayKey(d), onDay(occ, d));
    return m;
  }, [occ, grid]);
  const today = new Date();
  const list = byDay.get(dayKey(sel)) ?? onDay(expand(shown, sel, new Date(sel.getTime() + 86400000)), sel);
  const move = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => move(-1)} hitSlop={12}><Text style={s.nav}>‹</Text></Pressable>
        <Text style={s.title}>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</Text>
        <Pressable onPress={() => move(1)} hitSlop={12}><Text style={s.nav}>›</Text></Pressable>
        <View style={{ flex: 1 }} />
        <Link href="/settings" style={s.link}>설정</Link>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chips} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        <Chip label="전체" color={C.primary} on={state.activeProfileId === null} onPress={() => setActive(null)} />
        {state.profiles.map((p) => (
          <Chip key={p.id} label={p.name} color={p.color} on={state.activeProfileId === p.id} onPress={() => setActive(p.id)} />
        ))}
        <Chip label="＋ 관리" color={C.sub} on={false} onPress={() => router.push('/profiles')} />
      </ScrollView>

      <View style={s.row}>{DOW.map((d, i) => <Text key={d} style={[s.dow, i === 0 && { color: C.danger }]}>{d}</Text>)}</View>
      <View style={s.grid}>
        {grid.map((d) => {
          const items = byDay.get(dayKey(d)) ?? [];
          const out = d.getMonth() !== cursor.getMonth();
          const isSel = sameDay(d, sel);
          return (
            <Pressable key={d.toISOString()} style={s.cell} onPress={() => setSel(d)}>
              <View style={[s.num, isSel && { backgroundColor: C.primary }, !isSel && sameDay(d, today) && { borderWidth: 1, borderColor: C.primary }]}>
                <Text style={[s.numT, out && { color: '#C4C9D2' }, isSel && { color: '#fff' }]}>{d.getDate()}</Text>
              </View>
              <View style={s.dots}>
                {items.slice(0, 3).map((o, i) => (
                  <View key={i} style={[s.dot, { backgroundColor: profileOf(state.profiles, o.event.profileId).color }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={s.agenda} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Text style={s.agendaTitle}>{sel.getMonth() + 1}월 {sel.getDate()}일 ({DOW[sel.getDay()]})</Text>
        {list.length === 0 && <Text style={{ color: C.sub }}>일정이 없어요</Text>}
        {list.map((o, i) => {
          const p = profileOf(state.profiles, o.event.profileId);
          return (
            <Pressable key={i} style={s.item} onPress={() => router.push(`/event/${o.event.id}`)}>
              <View style={[s.bar, { backgroundColor: p.color }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemT}>{o.event.title}</Text>
                <Text style={s.itemS}>
                  {o.event.allDay ? '종일' : `${fmtTime(o.start)} – ${fmtTime(o.end)}`} · {p.name}
                  {o.event.location ? ` · ${o.event.location}` : ''}
                </Text>
              </View>
              {o.event.attendees.length > 0 && <Text style={s.itemS}>👥 {o.event.attendees.length}</Text>}
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable style={s.fab} onPress={() => router.push({ pathname: '/event/[id]', params: { id: 'new', date: sel.toISOString() } })}>
        <Text style={s.fabT}>＋</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Chip({ label, color, on, onPress }: { label: string; color: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, { borderColor: color }, on && { backgroundColor: color }]}>
      <Text style={{ color: on ? '#fff' : color, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: C.text },
  nav: { fontSize: 28, color: C.text },
  link: { color: C.primary, fontWeight: '600' },
  chips: { flexGrow: 0, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  row: { flexDirection: 'row', paddingHorizontal: 8 },
  dow: { flex: 1, textAlign: 'center', color: C.sub, fontSize: 12, paddingBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center' },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  numT: { fontSize: 14, color: C.text },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  agenda: { flex: 1, backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, marginTop: 8 },
  agendaTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12, color: C.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  itemT: { fontSize: 15, fontWeight: '600', color: C.text },
  itemS: { fontSize: 12, color: C.sub, marginTop: 2 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 56, height: 56, borderRadius: 28, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 4 },
  fabT: { color: '#fff', fontSize: 28, marginTop: -2 },
});
