import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textColorOn } from '../lib/layout';
import { EVENT_COLORS, Theme, useTheme } from './theme';

/** 일정 색상 선택. 첫 칸은 "프로필 색 따라가기"(기본값) */
export function ColorPicker({ value, profileColor, onChange }: {
  value?: string; profileColor?: string; onChange: (c: string | undefined) => void;
}) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  return (
    <View style={s.wrap}>
      <Pressable onPress={() => onChange(undefined)} accessibilityRole="button" accessibilityState={{ selected: !value }}
        accessibilityLabel="프로필 색 사용" style={[s.auto, !value && s.autoOn]}>
        <View style={[s.autoDot, { backgroundColor: profileColor ?? t.primary }]} />
        <Text style={s.autoT}>프로필 색</Text>
      </Pressable>
      {EVENT_COLORS.map((c) => (
        <Pressable key={c} onPress={() => onChange(c)} accessibilityRole="button" accessibilityLabel={`색상 ${c}`}
          accessibilityState={{ selected: value === c }} style={[s.dot, { backgroundColor: c }]}>
          {value === c && <Ionicons name="checkmark" size={18} color={textColorOn(c)} />}
        </Pressable>
      ))}
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12, paddingVertical: 14 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  auto: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: t.input, borderWidth: 2, borderColor: 'transparent' },
  autoOn: { borderColor: t.primary },
  autoDot: { width: 12, height: 12, borderRadius: 6 },
  autoT: { fontSize: 13, fontWeight: '700', color: t.text },
});
