import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Pill, Row, Section } from '../../components/ui';
import { ColorPicker } from '../../components/ColorPicker';
import { Theme, useTheme } from '../../components/theme';
import * as G from '../../lib/google';
import { shareEvents } from '../../lib/share';
import { startOfDay } from '../../lib/dates';
import { fmtLunar, lunarToSolar, solarToLunar } from '../../lib/lunar';
import { uid, useStore } from '../../lib/store';
import type { CalEvent, LunarDate, Repeat } from '../../lib/types';

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
      set({ start: d.toISOString(), end: new Date(d.getTime() + dur).toISOString(), ...(ev.lunar ? { lunar: solarToLunar(d) ?? ev.lunar } : {}) });
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

  // 종일 ↔ 시간 전환 시 시각도 함께 정리: 종일은 00:00 기준 날짜로, 시간 일정으로 돌아오면 오전 9시부터 1시간
  const toggleAllDay = (on: boolean) => {
    const s0 = new Date(ev.start), e0 = new Date(ev.end);
    if (on) return set({ allDay: true, start: startOfDay(s0).toISOString(), end: startOfDay(e0 < s0 ? s0 : e0).toISOString() });
    const st = new Date(s0.getFullYear(), s0.getMonth(), s0.getDate(), 9);
    const multi = startOfDay(e0) > startOfDay(s0);
    const en = multi ? new Date(e0.getFullYear(), e0.getMonth(), e0.getDate(), 10) : new Date(st.getTime() + 3600000);
    set({ allDay: false, start: st.toISOString(), end: en.toISOString() });
  };

  const toggleLunar = (on: boolean) => {
    if (!on) return set({ lunar: undefined, repeat: 'none' });
    const l = solarToLunar(new Date(ev.start));
    if (!l) return Alert.alert('음력을 지원하지 않는 날짜예요', '양력 1000~2050년 범위에서만 음력을 쓸 수 있어요.');
    set({ lunar: { month: l.month, day: l.day, leap: l.leap }, repeat: 'yearly' });
  };

  // 음력 월/일/윤달을 바꾸면, 같은 음력 연도의 해당 양력 날짜로 시작·종료일을 옮김
  const setLunar = (next: LunarDate) => {
    const cur = new Date(ev.start);
    const year = solarToLunar(cur)?.year;
    const solar = year ? lunarToSolar(year, next) : null;
    if (!solar) return Alert.alert('해당 음력 날짜를 찾을 수 없어요');
    const ns = new Date(solar.getFullYear(), solar.getMonth(), solar.getDate(), cur.getHours(), cur.getMinutes());
    const delta = ns.getTime() - cur.getTime();
    set({ lunar: next, start: ns.toISOString(), end: new Date(new Date(ev.end).getTime() + delta).toISOString() });
  };
  const lunarFallback = ev.lunar && solarToLunar(new Date(ev.start)) &&
    (solarToLunar(new Date(ev.start))!.leap !== ev.lunar.leap);

  const save = async () => {
    if (!ev.title.trim()) return Alert.alert('제목을 입력해 주세요');
    setSaving(true);
    const attendees = mails.split(/[,\s]+/).filter((m) => /.+@.+\..+/.test(m));
    let out: CalEvent = { ...ev, title: ev.title.trim(), attendees, updatedAt: new Date().toISOString() };
    if (out.allDay) out = { ...out, start: startOfDay(new Date(out.start)).toISOString(), end: startOfDay(new Date(out.end)).toISOString() };
    if (state.google.connected) {
      // 구글에 못 올리면(토큰 만료·네트워크·API 오류) 기기에는 저장하고 pendingSync로 표시 → 다음 동기화 때 다시 올림
      out = { ...out, pendingSync: true };
      const token = await G.freshAccessToken();
      if (token) {
        try {
          const r = await G.pushEvent(token, out);
          out = { ...out, googleId: r.id, pendingSync: r.problems.length > 0 };
          if (r.problems.length) Alert.alert('구글에 일부만 반영됐어요', r.problems.join('\n') + '\n기기에는 저장됐고, 설정에서 "지금 동기화"로 다시 시도해요.');
        }
        catch (e) { Alert.alert('구글 동기화 실패', '기기에는 저장됐어요. 설정에서 "지금 동기화"를 누르면 다시 올려요.\n' + String(e)); }
      } else {
        Alert.alert('구글 연결이 만료됐어요', '기기에는 저장됐어요. 설정에서 구글을 다시 연결한 뒤 동기화하면 반영돼요.');
      }
    }
    saveEvent(out);
    router.back();
  };

  const remove = () => Alert.alert('일정 삭제', '이 일정을 삭제할까요?', [
    { text: '취소', style: 'cancel' },
    { text: '삭제', style: 'destructive', onPress: async () => {
      const token = existing?.googleId && state.google.connected ? await G.freshAccessToken() : null;
      if (token && existing?.googleId) await G.removeEvent(token, existing.googleId).catch(() => {});
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

        <Section title="색상">
          <ColorPicker value={ev.color} profileColor={state.profiles.find((p) => p.id === ev.profileId)?.color} onChange={(color) => set({ color })} />
        </Section>

        <Section>
          <Row icon="sunny-outline" label="종일" right={<Switch value={ev.allDay} onValueChange={toggleAllDay} trackColor={{ true: t.primary }} />} />
          <Row icon="play-outline" label="시작" onPress={() => openPicker('start')} right={<Text style={s.val}>{fmt(ev.start)}</Text>} />
          <Row icon="stop-outline" label="종료" onPress={() => openPicker('end')} right={<Text style={s.val}>{fmt(ev.end)}</Text>} last />
        </Section>
        <Section>
          <Row icon="moon-outline" label="음력" last={!ev.lunar}
            right={<Switch value={!!ev.lunar} onValueChange={toggleLunar} trackColor={{ true: t.primary }} />} />
          {ev.lunar && (
            <View style={s.lunarBox}>
              <Text style={s.lunarT}>{fmtLunar(ev.lunar)}</Text>
              <View style={s.steppers}>
                <Stepper t={t} s={s} label="월" value={ev.lunar.month} min={1} max={12}
                  onChange={(month) => setLunar({ ...ev.lunar!, month })} />
                <Stepper t={t} s={s} label="일" value={ev.lunar.day} min={1} max={30}
                  onChange={(day) => setLunar({ ...ev.lunar!, day })} />
                <Pill text="윤달" on={ev.lunar.leap} onPress={() => setLunar({ ...ev.lunar!, leap: !ev.lunar!.leap })} />
              </View>
              <Text style={s.hint}>
                {ev.repeat === 'yearly' ? '매년 같은 음력 날짜에 반복돼요 (양력으로는 해마다 날짜가 달라져요).' : '반복 없이 이 날짜에만 표시돼요.'}
                {ev.lunar.leap ? ' 윤달이 없는 해에는 같은 숫자의 평달로 표시돼요.' : ''}
                {ev.lunar.day === 30 ? ' 그 달이 29일까지면 29일에 표시돼요.' : ''}
              </Text>
              {lunarFallback ? <Text style={s.hint}>※ 선택한 해에는 윤달이 없어서 평달 날짜예요.</Text> : null}
            </View>
          )}
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
          <View style={s.wrap}>
            {REPEATS.filter(([v]) => !ev.lunar || v === 'none' || v === 'yearly').map(([v, l]) => (
              <Pill key={v} text={ev.lunar && v === 'yearly' ? '매년 (음력)' : l} on={ev.repeat === v} onPress={() => set({ repeat: v })} />
            ))}
          </View>
        </Section>
        <Section title="알림">
          <View style={s.wrap}>{REMINDERS.map(([v, l]) => <Pill key={l} text={l} on={ev.reminderMinutes === v} onPress={() => set({ reminderMinutes: v, remindersDefault: false })} />)}</View>
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

function Stepper({ t, s, label, value, min, max, onChange }: {
  t: Theme; s: ReturnType<typeof styles>; label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  const wrap = (v: number) => (v < min ? max : v > max ? min : v);
  return (
    <View style={s.stepper}>
      <Pressable onPress={() => onChange(wrap(value - 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} 줄이기`}>
        <Text style={s.stepBtn}>−</Text>
      </Pressable>
      <Text style={s.stepVal}>{value}{label}</Text>
      <Pressable onPress={() => onChange(wrap(value + 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${label} 늘리기`}>
        <Text style={s.stepBtn}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  title: { fontSize: 26, fontWeight: '800', color: t.text, paddingVertical: 6, paddingHorizontal: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 12 },
  val: { fontSize: 15, color: t.primary, fontWeight: '600' },
  input: { fontSize: 16, color: t.text, textAlign: 'left', alignSelf: 'stretch', paddingVertical: 6 },
  lunarBox: { gap: 10, paddingBottom: 14 },
  lunarT: { fontSize: 17, fontWeight: '800', color: t.primary },
  steppers: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.input, borderRadius: 17, paddingHorizontal: 12, height: 34 },
  stepBtn: { fontSize: 18, color: t.primary, fontWeight: '800', width: 20, textAlign: 'center' },
  stepVal: { fontSize: 14, fontWeight: '700', color: t.text, minWidth: 34, textAlign: 'center' },
  hint: { fontSize: 12, color: t.sub, marginTop: -8, marginLeft: 6, lineHeight: 17 },
});
