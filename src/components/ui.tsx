import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { R, Theme, useTheme } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

/** 둥근 카드 섹션 (설정/폼 공통) */
export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  const t = useTheme();
  const s = useMemo(() => st(t), [t]);
  return (
    <View style={{ gap: 8 }}>
      {title && <Text style={s.sectionT}>{title}</Text>}
      <View style={s.section}>{children}</View>
    </View>
  );
}

/** 아이콘 + 라벨 + 오른쪽 컨텐츠 행 */
export function Row({ icon, label, right, onPress, last, danger }: {
  icon: IconName; label?: string; right?: React.ReactNode; onPress?: () => void; last?: boolean; danger?: boolean;
}) {
  const t = useTheme();
  const s = useMemo(() => st(t), [t]);
  const body = (
    <View style={[s.row, !last && s.rowLine]}>
      <Ionicons name={icon} size={20} color={danger ? t.danger : t.sub} style={{ width: 24 }} />
      {label !== undefined && <Text style={[s.rowT, danger && { color: t.danger }]}>{label}</Text>}
      <View style={label !== undefined ? { flexShrink: 0, alignItems: 'flex-end' } : { flex: 1, alignItems: 'stretch', minWidth: 0 }}>{right}</View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable> : body;
}

export function Pill({ text, on, color, onPress }: { text: string; on: boolean; color?: string; onPress: () => void }) {
  const t = useTheme();
  const c = color ?? t.primary;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={{ paddingHorizontal: 14, height: 34, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
        backgroundColor: on ? c : t.input }}>
      {color && !on && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      <Text style={{ color: on ? '#fff' : t.text, fontWeight: '600', fontSize: 14 }}>{text}</Text>
    </Pressable>
  );
}

export function Button({ text, onPress, kind = 'primary', disabled, icon }: {
  text: string; onPress: () => void; kind?: 'primary' | 'soft' | 'danger'; disabled?: boolean; icon?: IconName;
}) {
  const t = useTheme();
  const bg = kind === 'primary' ? t.primary : kind === 'danger' ? 'transparent' : t.primarySoft;
  const fg = kind === 'primary' ? '#fff' : kind === 'danger' ? t.danger : t.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={{ height: 50, borderRadius: R.md, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: disabled ? 0.5 : 1 }}>
      {icon && <Ionicons name={icon} size={18} color={fg} />}
      <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>{text}</Text>
    </Pressable>
  );
}

const st = (t: Theme) => StyleSheet.create({
  sectionT: { fontSize: 13, fontWeight: '700', color: t.sub, marginLeft: 6 },
  section: { backgroundColor: t.card, borderRadius: R.md, paddingHorizontal: 16, boxShadow: t.shadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line },
  rowT: { fontSize: 16, color: t.text, flex: 1 },
});
