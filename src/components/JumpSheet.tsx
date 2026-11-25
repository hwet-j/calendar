import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventColor } from '../lib/filter';
import { parseDateQuery, searchEvents } from '../lib/jump';
import type { CalEvent, Profile } from '../lib/types';
import { R, Theme, useTheme } from './theme';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const MIN_Y = 1900, MAX_Y = 2100;

interface Props {
  visible: boolean;
  /** 지금 보고 있는 달 */
  cursor: Date;
  events: CalEvent[];
  profiles: Profile[];
  onClose: () => void;
  /** 선택한 날짜로 이동 (월만 고르면 그 달의 1일, 이번 달이면 오늘) */
  onJump: (d: Date) => void;
}

/** 연/월 빠른 이동 + 날짜 입력·일정 검색 시트 */
export function JumpSheet({ visible, cursor, events, profiles, onClose, onJump }: Props) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const [year, setYear] = useState(cursor.getFullYear());
  const [q, setQ] = useState('');
  const now = new Date();

  // 열릴 때마다 현재 보고 있는 연도/빈 검색어로 초기화
  useEffect(() => { if (visible) { setYear(cursor.getFullYear()); setQ(''); } }, [visible, cursor]);

  const target = useMemo(() => parseDateQuery(q, cursor), [q, cursor]);
  const hits = useMemo(() => searchEvents(events, q, now), [events, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const searching = q.trim().length > 0;

  const go = (d: Date) => { Haptics.selectionAsync().catch(() => {}); onJump(d); onClose(); };
  const goMonth = (y: number, m: number) => {
    const isNow = y === now.getFullYear() && m === now.getMonth();
    go(isNow ? now : new Date(y, m, 1));
  };
  const fmtDate = (d: Date) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} (${DOW[d.getDay()]})`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="닫기" />
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.grab} />
          <View style={s.searchBox}>
            <Ionicons name="search" size={18} color={t.sub} />
            <TextInput style={s.input} value={q} onChangeText={setQ} placeholder="날짜(2027.3) 또는 일정 검색"
              placeholderTextColor={t.faint} returnKeyType="search" autoCorrect={false} accessibilityLabel="날짜 또는 일정 검색"
              onSubmitEditing={() => { if (target) go(new Date(target.year, target.month - 1, target.day ?? 1)); else if (hits[0]) go(hits[0].date); }} />
            {searching && (
              <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityLabel="검색어 지우기">
                <Ionicons name="close-circle" size={18} color={t.faint} />
              </Pressable>
            )}
          </View>

          {!searching ? (
            <View>
              <View style={s.yearRow}>
                <Pressable onPress={() => setYear((y) => Math.max(MIN_Y, y - 1))} hitSlop={10} style={s.yBtn} accessibilityLabel="이전 해">
                  <Ionicons name="chevron-back" size={22} color={t.text} />
                </Pressable>
                <Text style={s.yearT}>{year}년</Text>
                <Pressable onPress={() => setYear((y) => Math.min(MAX_Y, y + 1))} hitSlop={10} style={s.yBtn} accessibilityLabel="다음 해">
                  <Ionicons name="chevron-forward" size={22} color={t.text} />
                </Pressable>
              </View>
              <View style={s.months}>
                {Array.from({ length: 12 }, (_, m) => {
                  const on = year === cursor.getFullYear() && m === cursor.getMonth();
                  const isNow = year === now.getFullYear() && m === now.getMonth();
                  return (
                    <Pressable key={m} style={s.mCell} onPress={() => goMonth(year, m)} accessibilityRole="button"
                      accessibilityState={{ selected: on }} accessibilityLabel={`${year}년 ${m + 1}월`}>
                      <View style={[s.mPill, on && { backgroundColor: t.primary }, !on && isNow && { backgroundColor: t.primarySoft }]}>
                        <Text style={[s.mT, on && { color: '#fff', fontWeight: '800' }, !on && isNow && { color: t.primary, fontWeight: '800' }]}>{m + 1}월</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable style={s.today} onPress={() => go(now)} accessibilityRole="button">
                <Ionicons name="today-outline" size={18} color={t.primary} />
                <Text style={s.todayT}>오늘로 이동</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={hits}
              keyExtractor={(h) => h.event.id}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 360 }}
              ListHeaderComponent={target ? (
                <Pressable style={s.resRow} onPress={() => go(new Date(target.year, target.month - 1, target.day ?? 1))} accessibilityRole="button">
                  <View style={[s.resIcon, { backgroundColor: t.primarySoft }]}><Ionicons name="arrow-forward" size={16} color={t.primary} /></View>
                  <Text style={s.resT}>{target.year}년 {target.month}월{target.day ? ` ${target.day}일` : ''}(으)로 이동</Text>
                </Pressable>
              ) : undefined}
              ListEmptyComponent={!target ? <Text style={s.empty}>검색 결과가 없어요</Text> : undefined}
              renderItem={({ item }) => (
                <Pressable style={s.resRow} onPress={() => go(item.date)} accessibilityRole="button" accessibilityLabel={item.event.title}>
                  <View style={[s.resBar, { backgroundColor: eventColor(item.event, profiles) }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.resT} numberOfLines={1}>{item.event.title}</Text>
                    <Text style={s.resS} numberOfLines={1}>
                      {fmtDate(item.date)}{item.event.repeat !== 'none' ? ' · 반복' : ''}{item.event.location ? ` · ${item.event.location}` : ''}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { backgroundColor: t.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: t.line, marginBottom: 4 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.input, borderRadius: R.md, paddingHorizontal: 14, height: 46 },
  input: { flex: 1, fontSize: 16, color: t.text, paddingVertical: 0 },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 4 },
  yBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  yearT: { fontSize: 22, fontWeight: '800', color: t.text },
  months: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  mCell: { width: '25%', alignItems: 'center', paddingVertical: 6 },
  mPill: { minWidth: 64, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  mT: { fontSize: 16, color: t.text, fontWeight: '600' },
  today: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, marginTop: 6, borderRadius: R.md, backgroundColor: t.primarySoft },
  todayT: { color: t.primary, fontWeight: '700', fontSize: 15 },
  resRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line },
  resIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  resT: { fontSize: 16, fontWeight: '700', color: t.text },
  resS: { fontSize: 12, color: t.sub, marginTop: 2 },
  empty: { textAlign: 'center', color: t.sub, paddingVertical: 28, fontSize: 14 },
});
