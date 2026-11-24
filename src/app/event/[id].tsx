import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Pill, Row, Section } from '../../components/ui';
import { Theme, useTheme } from '../../components/theme';
import * as G from '../../lib/google';
import { shareEvents } from '../../lib/share';
import { uid, useStore } from '../../lib/store';
import type { CalEvent, Repeat } from '../../lib/types';

const REPEATS: [Repeat, string][] = [['none', '안 함'], ['daily', '매일'], ['weekly', '매주'], ['monthly', '매월'], ['yearly', '매년']];
const REMINDERS: [number | undefined, string][] = [[undefined, '없음'], [0, '정각'], [10, '10분 전'], [30, '30분 전'], [60, '1시간 전'], [1440, '하루 전']];

type PickerState = null | { which: 'start' | 'end'; mode: 'date' | 'time' | 'datetime' };

export default function EventScreen() {
  const { ready } = useStore();
  // 저장소 로딩 전에 폼 상태를 만들면 기존 일정이 비어 보이므로 로딩이 끝난 뒤에 렌더
  return ready ? <EventForm /> : null;
}

function EventForm() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const { state, saveEvent, deleteEvent } = useStore();
  const existing = state.events.find((e) => e.id === id);

  const [ev, setEv] = useState<CalEvent>(() => {
    if (existing) return existing;
    const b = date ? new Date(date) : new Date();
    const h = Math.min(new Date().getHours() + 1, 22);
    return {
      id: uid(), profileId: state.activeProfileId ?? state.profiles[0].id,
      title: '', allDay: false, repeat: 'none', reminderMinutes: 10, attendees: [],
      start: new Date(b.getFullYear(), b.getMonth(), b.getDate(), h).toISOString(),
      end: new Date(b.getFullYear(), b.getMonth(), b.getDate(), h + 1).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });
  const [mails, setMails] = useState(ev.attendees.join(', '));
  const [picker, setPicker] = useState<PickerState>(null);
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<CalEvent>) => setEv((e) => ({ ...e, ...p }));

  const apply = (which: 'start' | 'end', d: Date) => {
    if (which === 'start') {
      const dur = Math.max(new Date(ev.end).getTime() - new Date(ev.start).getTime(), 0);
      set({ start: d.toISOString(), end: new Date(d.getTime() + dur).toISOString() });
    } else set({ end: (d < new Date(ev.start) ? new Date(ev.start) : d).toISOString() });
  };

  // Android는 'datetime' 모드가 없어서 날짜 → 시간 순서로 두 번 선택
  const openPicker = (which: 'start' | 'end') =>
    setPicker({ which, mode: Platform.OS === 'ios' ? (ev.allDay ? 'date' : 'datetime') : 'date' });

  const onPick = (d: Date) => {
    if (!picker) return;
    const cur = new Date(picker.which === 'start' ? ev.start : ev.end);
    if (Platform.OS !== 'android') { apply(picker.which, d); return; }
    if (picker.mode === 'date') {
      apply(picker.which, new Date(d.getFullYear(), d.getMonth(), d.getDate(), cur.getHours(), cur.getMinutes()));
      setPicker(ev.allDay ? null : { which: picker.which, mode: 'time' });
    } else {
      apply(picker.which, new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), d.getHours(), d.getMinutes()));
      setPicker(null);
    }
  };

  const save = async () => {
    if (!ev.title.trim()) return Alert.alert('제목을 입력해 주세요');
    setSaving(true);
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

  const fmt = (iso: string) => new Date(iso).toLocaleString('ko-KR', ev.allDay
    ? { month: 'long', day: 'numeric', weekday: 'short' }
    : { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? '일정 수정' : '새 일정' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <TextInput style={s.title} placeholder="일정 제목" placeholderTextColor={t.faint} value={ev.title}
          onChangeText={(title) => set({ title })} autoFocus={!existing} returnKeyType="done" accessibilityLabel="일정 제목" />

        <Section title="프로필">
          <View style={s.wrap}>
            {state.profiles.map((p) => <Pill key={p.id} text={p.name} color={p.color} on={ev.profileId === p.id} onPress={() => set({ profileId: p.id })} />)}
          </View>
        </Section>

        <Section>
          <Row icon="sunny-outline" label="종일" right={<Switch value={ev.allDay} onValueChange={(allDay) => set({ allDay })} trackColor={{ true: t.primary }} />} />
          <Row icon="play-outline" label="시작" onPress={() => openPicker('start')} right={<Text style={s.val}>{fmt(ev.start)}</Text>} />
          <Row icon="stop-outline" label="종료" onPress={() => openPicker('end')} right={<Text style={s.val}>{fmt(ev.end)}</Text>} last />
        </Section>
        {picker && (
          <DateTimePicker
            value={new Date(picker.which === 'start' ? ev.start : ev.end)}
            mode={picker.mode}
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onValueChange={(_, d) => onPick(d)}
            onDismiss={() => setPicker(null)}
          />
        )}

        <Section>
          <Row icon="location-outline" right={<TextInput style={s.input} placeholder="장소" placeholderTextColor={t.faint} value={ev.location} onChangeText={(location) => set({ location })} />} />
          <Row icon="document-text-outline" last right={<TextInput style={[s.input, { minHeight: 56, textAlignVertical: 'top' }]} placeholder="메모" placeholderTextColor={t.faint} multiline value={ev.notes} onChangeText={(notes) => set({ notes })} />} />
        </Section>

        <Section title="반복">
          <View style={s.wrap}>{REPEATS.map(([v, l]) => <Pill key={v} text={l} on={ev.repeat === v} onPress={() => set({ repeat: v })} />)}</View>
        </Section>
        <Section title="알림">
          <View style={s.wrap}>{REMINDERS.map(([v, l]) => <Pill key={l} text={l} on={ev.reminderMinutes === v} onPress={() => set({ reminderMinutes: v })} />)}</View>
        </Section>

        <Section title="공유">
          <Row icon="people-outline" last right={
            <TextInput style={s.input} placeholder="친구 이메일 (쉼표로 구분)" placeholderTextColor={t.faint} autoCapitalize="none"
              keyboardType="email-address" value={mails} onChangeText={setMails} />} />
        </Section>
        <Text style={s.hint}>구글 계정을 연결해 두면 저장할 때 구글 캘린더가 이 이메일들로 초대를 보내요.</Text>

        <View style={{ gap: 8 }}>
          <Button text={saving ? '저장 중…' : '저장'} onPress={save} disabled={saving} />
          {existing && <Button text=".ics 파일로 공유" icon="share-outline" kind="soft" onPress={() => shareEvents([existing], 'event.ics')} />}
          {existing && <Button text="삭제" kind="danger" onPress={remove} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: t.text, paddingVertical: 6, paddingHorizontal: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  val: { fontSize: 15, color: t.primary, fontWeight: '600' },
  input: { fontSize: 16, color: t.text, textAlign: 'left', alignSelf: 'stretch', paddingVertical: 6 },
  hint: { fontSize: 12, color: t.sub, marginTop: -8, marginLeft: 6, lineHeight: 17 },
});
