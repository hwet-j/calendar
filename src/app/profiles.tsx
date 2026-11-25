import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { R, Theme, useTheme } from '../components/theme';
import { Button } from '../components/ui';
import { PALETTE, uid, useStore } from '../lib/store';

export default function Profiles() {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { state, saveProfile, deleteProfile } = useStore();
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    const used = new Set(state.profiles.map((p) => p.color));
    saveProfile({ id: uid(), name: name.trim(), color: PALETTE.find((c) => !used.has(c)) ?? PALETTE[0], visible: true });
    setName('');
  };
  const confirmDelete = (id: string, n: string) =>
    Alert.alert('프로필 삭제', `'${n}' 프로필과 그 일정이 모두 삭제돼요.`, [
      { text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => deleteProfile(id) }]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
      <Text style={s.hint}>가족·회사처럼 프로필을 나눠 일정을 따로 보거나, '전체' 보기에서 함께 볼 프로필만 골라 볼 수 있어요. 홈 위젯도 같은 선택을 따라가요.</Text>

      {state.profiles.map((p) => (
        <View key={p.id} style={s.card}>
          <View style={s.top}>
            <View style={[s.avatar, { backgroundColor: p.color }]}><Text style={s.avatarT}>{(p.name || '?').slice(0, 1)}</Text></View>
            <TextInput style={s.name} value={p.name} onChangeText={(v) => saveProfile({ ...p, name: v })} placeholder="프로필 이름" placeholderTextColor={t.faint} />
            {state.profiles.length > 1 && (
              <Pressable onPress={() => confirmDelete(p.id, p.name)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`${p.name} 삭제`}>
                <Ionicons name="trash-outline" size={20} color={t.danger} />
              </Pressable>
            )}
          </View>
          <View style={s.colors}>
            {PALETTE.map((c) => (
              <Pressable key={c} onPress={() => saveProfile({ ...p, color: c })} accessibilityRole="button" accessibilityLabel={`색상 ${c}`}
                style={[s.swatch, { backgroundColor: c }, p.color === c && { borderWidth: 3, borderColor: t.card, boxShadow: `0 0 0 2px ${c}` }]} />
            ))}
          </View>
          <View style={s.vis}>
            <Text style={s.visT}>'전체' 보기에 포함</Text>
            <Switch value={p.visible} onValueChange={(v) => saveProfile({ ...p, visible: v })} trackColor={{ true: t.primary }} />
          </View>
        </View>
      ))}

      <View style={s.card}>
        <Text style={s.visT}>새 프로필</Text>
        <TextInput style={s.add} placeholder="예: 가족, 회사, 운동" placeholderTextColor={t.faint} value={name} onChangeText={setName} onSubmitEditing={add} returnKeyType="done" />
        <Button text="프로필 추가" icon="add" onPress={add} disabled={!name.trim()} />
      </View>
    </ScrollView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  hint: { fontSize: 13, color: t.sub, lineHeight: 19, marginHorizontal: 4 },
  card: { backgroundColor: t.card, borderRadius: R.md, padding: 16, gap: 14, boxShadow: t.shadow },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  avatarT: { color: '#fff', fontWeight: '800', fontSize: 17 },
  name: { flex: 1, minWidth: 0, fontSize: 18, fontWeight: '700', color: t.text, paddingVertical: 4 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  swatch: { width: 28, height: 28, borderRadius: 14 },
  vis: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  visT: { fontSize: 15, color: t.text, fontWeight: '600' },
  add: { backgroundColor: t.input, borderRadius: R.sm, paddingHorizontal: 14, height: 46, fontSize: 16, color: t.text },
});
