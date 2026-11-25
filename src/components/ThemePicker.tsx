import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ThemeChoice } from '../lib/types';
import { black, dark, light, R, Theme, useTheme } from './theme';

const OPTIONS: { key: ThemeChoice; label: string }[] = [
  { key: 'system', label: '시스템' },
  { key: 'light', label: '라이트' },
  { key: 'dark', label: '다크' },
  { key: 'black', label: '블랙' },
];

/** 미리보기 칸: 해당 테마의 배경/글자/강조색으로 작은 화면을 그림. '시스템'은 라이트/다크 반반 */
function Preview({ k }: { k: ThemeChoice }) {
  const half = (p: Theme, style: object) => (
    <View style={[s.half, { backgroundColor: p.bg }, style]}>
      <Text style={[s.aa, { color: p.text }]}>Aa</Text>
      <View style={[s.bar, { backgroundColor: p.primary }]} />
    </View>
  );
  if (k === 'system') return <View style={s.prev}>{half(light, {})}{half(dark, {})}</View>;
  return <View style={s.prev}>{half(k === 'light' ? light : k === 'dark' ? dark : black, { flex: 1 })}</View>;
}

/** 앱과 홈 위젯에 적용되는 화면 테마 선택 */
export function ThemePicker({ value, onChange }: { value: ThemeChoice; onChange: (t: ThemeChoice) => void }) {
  const t = useTheme();
  const st = useMemo(() => styles(t), [t]);
  return (
    <View style={st.row}>
      {OPTIONS.map((o) => {
        const on = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={st.tile} accessibilityRole="radio"
            accessibilityState={{ selected: on }} accessibilityLabel={`${o.label} 테마`}>
            <View style={[st.frame, on && { borderColor: t.primary }]}>
              <Preview k={o.key} />
              {on && <View style={st.check}><Ionicons name="checkmark" size={12} color="#fff" /></View>}
            </View>
            <Text style={[st.label, on && { color: t.primary, fontWeight: '800' }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  prev: { flex: 1, flexDirection: 'row', borderRadius: 9, overflow: 'hidden' },
  half: { flex: 1, padding: 6, justifyContent: 'space-between' },
  aa: { fontSize: 15, fontWeight: '800' },
  bar: { height: 5, borderRadius: 3, width: '70%' },
});
const styles = (t: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, paddingVertical: 14 },
  tile: { flex: 1, alignItems: 'center', gap: 6 },
  frame: { width: '100%', height: 64, borderRadius: R.sm + 2, padding: 2, borderWidth: 2, borderColor: t.line },
  check: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: t.text },
});
