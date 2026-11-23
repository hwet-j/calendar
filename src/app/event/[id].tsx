import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { C } from '../../components/theme';
import * as G from '../../lib/google';
import { shareEvents } from '../../lib/share';
import { uid, useStore } from '../../lib/store';
import type { CalEvent, Repeat } from '../../lib/types';

const REPEATS: [Repeat, string][] = [['none', '없음'], ['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년']];
const REMINDERS: [number | undefined, string][] = [[undefined, '없음'], [0, '정각'], [10, '10분 전'], [30, '30분 전'], [60, '1시간 전'], [1440, '하루 전']];

export default function EventScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { state, saveEvent, deleteEvent } = useStore();
  const existing = state.events.find((e) => e.id === id);
  const base = date ? new Date(date) : new Date();

  const [ev, setEv] = useState<CalEvent>(() => existing ?? {
    id: uid(),
    profileId: state.activeProfileId ?? state.profiles[0].id,
    title: '', allDay: false, repeat: 'none', reminderMinutes: 10, attendees: [],
    start: new Date(base.getFullYear(), base.getMonth(), base.getDate(), new Date().getHours() + 1).toISOString(),
    end: new Date(base.getFullYear(), base.getMonth(), base.getDate(), new Date().getHours() + 2).toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const [mails, setMails] = useState(ev.attendees.join(', '));
  const [picker, setPicker] = useState<null | 'start' | 'end'>(null);
  const set = (p: Partial<CalEvent>) => setEv((e) => ({ ...e, ...p }));

  const onPick = (which: 'start' | 'end', d?: Date) => {
    setPicker(Platform.OS === 'ios' ? picker : null);
    if (!d) return;
    if (which === 'start') {
      const dur = new Date(ev.end).getTime() - new Date(ev.start).getTime();
      set({ start: d.toISOString(), end: new Date(d.getTime() + Math.max(dur, 0)).toISOString() });
    } else set({ end: (d < new Date(ev.start) ? new Date(ev.start) : d).toISOString() });
  };

  const save = async () => {
    if (!ev.title.trim()) return Alert.alert('제목을 입력해 주세요');
    const attendees = mails.split(/[,\s]+/).filter((m) => /.+@.+\..+/.test(m));
    let out: CalEvent = { ...ev, title: ev.title.trim(), attendees, updatedAt: new Date().toISOString() };
    const tok = state.google.connected ? await G.loadToken() : null;
    if (tok && tok.expiresAt > Date.now()) {
      try { out = { ...out, googleId: await G.pushEvent(tok.accessToken, out) }; }
      catch (e) { Alert.alert('구글 동기화 실패', '기기에는 저장됐어요. 설정에서 다시 동기화해 보세요.\n' + String(e)); }
    }
    saveEvent(out);
    router.back();
  };

  const remove = () => Alert.alert('일정 삭제', '이 일정을 삭제할까요?', [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: async () => {
      const tok = existing?.googleId && state.google.connected ? await G.loadToken() : null;
      if (tok && existing?.googleId) await G.removeEvent(tok.accessToken, existing.googleId).catch(() => {});
      deleteEvent(ev.id); router.back();
    } },
  ]);

  const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: ev.allDay ? undefined : 'short' });

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      <TextInput style={s.title} placeholder="제목" value={ev.title} onChangeText={(title) => set({ title })} />

      <Label t="프로필" />
      <View style={s.wrap}>
        {state.profiles.map((p) => (
          <Pill key={p.id} on={ev.profileId === p.id} color={p.color} t={p.name} onPress={() => set({ profileId: p.id })} />
        ))}
      </View>

      <View style={s.line}><Text style={s.t}>종일</Text><Switch value={ev.allDay} onValueChange={(allDay) => set({ allDay })} /></View>
      <Pressable style={s.line} onPress={() => setPicker('start')}><Text style={s.t}>시작</Text><Text style={s.val}>{fmt(ev.start)}</Text></Pressable>
      <Pressable style={s.line} onPress={() => setPicker('end')}><Text style={s.t}>종료</Text><Text style={s.val}>{fmt(ev.end)}</Text></Pressable>
      {picker && (
        <DateTimePicker
          value={new Date(picker === 'start' ? ev.start : ev.end)}
          mode={ev.allDay ? 'date' : 'datetime'}
          onChange={(_, d) => onPick(picker, d)}
        />
      )}

      <TextInput style={s.input} placeholder="장소" value={ev.location} onChangeText={(location) => set({ location })} />
      <TextInput style={[s.input, { minHeight: 70 }]} placeholder="메모" multiline value={ev.notes} onChangeText={(notes) => set({ notes })} />

      <Label t="반복" />
      <View style={s.wrap}>{REPEATS.map(([v, t]) => <Pill key={v} on={ev.repeat === v} t={t} onPress={() => set({ repeat: v })} />)}</View>
      <Label t="알림" />
      <View style={s.wrap}>{REMINDERS.map(([v, t]) => <Pill key={t} on={ev.reminderMinutes === v} t={t} onPress={() => set({ reminderMinutes: v })} />)}</View>

      <Label t="공유 (이메일, 쉼표로 구분)" />
      <TextInput style={s.input} placeholder="friend@gmail.com" autoCapitalize="none" keyboardType="email-address" value={mails} onChangeText={setMails} />
      <Text style={s.hint}>구글 계정이 연동돼 있으면 저장 시 구글 캘린더가 해당 이메일로 초대를 보내요.</Text>

      <Pressable style={s.primary} onPress={save}><Text style={s.primaryT}>저장</Text></Pressable>
      {existing && (
        <>
          <Pressable style={s.secondary} onPress={() => shareEvents([existing], 'event.ics')}><Text style={s.secondaryT}>.ics 파일로 공유</Text></Pressable>
          <Pressable style={s.secondary} onPress={remove}><Text style={[s.secondaryT, { color: C.danger }]}>삭제</Text></Pressable>
        </>
      )}
    </ScrollView>
  );
}

const Label = ({ t }: { t: string }) => <Text style={s.label}>{t}</Text>;
function Pill({ t, on, onPress, color = C.primary }: { t: string; on: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} style={[s.pill, { borderColor: color }, on && { backgroundColor: color }]}>
      <Text style={{ color: on ? '#fff' : color, fontWeight: '600' }}>{t}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: C.text, paddingVertical: 8 },
  label: { fontSize: 12, color: C.sub, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.card, padding: 14, borderRadius: 12 },
  t: { fontSize: 15, color: C.text }, val: { fontSize: 15, color: C.primary },
  input: { backgroundColor: C.card, padding: 14, borderRadius: 12, fontSize: 15, color: C.text },
  hint: { fontSize: 12, color: C.sub },
  primary: { backgroundColor: C.primary, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  primaryT: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { padding: 12, alignItems: 'center' }, secondaryT: { color: C.primary, fontWeight: '600' },
});
