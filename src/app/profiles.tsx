import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { C } from '../components/theme';
import { PALETTE, uid, useStore } from '../lib/store';

export default function Profiles() {
  const { state, saveProfile, deleteProfile } = useStore();
  const [name, setName] = useState('');
  const add = () => {
    if (!name.trim()) return;
    saveProfile({ id: uid(), name: name.trim(), color: PALETTE[state.profiles.length % PALETTE.length], visible: true });
    setName('');
  };
  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={s.hint}>프로필별로 일정을 따로 보거나, '전체' 보기에서 함께 볼 프로필을 켜고 끌 수 있어요. (홈 위젯도 같은 선택을 따라가요) 색 동그라미를 누르면 색이 바뀌어요.</Text>
      {state.profiles.map((p) => (
        <View key={p.id} style={s.card}>
          <Pressable onPress={() => saveProfile({ ...p, color: PALETTE[(PALETTE.indexOf(p.color) + 1) % PALETTE.length] })}>
            <View style={[s.swatch, { backgroundColor: p.color }]} />
          </Pressable>
          <TextInput style={s.name} value={p.name} onChangeText={(t) => saveProfile({ ...p, name: t })} />
          <Text style={s.sub}>전체에 표시</Text>
          <Switch value={p.visible} onValueChange={(v) => saveProfile({ ...p, visible: v })} />
          {state.profiles.length > 1 && (
            <Pressable onPress={() => Alert.alert('프로필 삭제', `'${p.name}'과(와) 그 일정이 모두 삭제돼요.`, [
              { text: '취소', style: 'cancel' }, { text: '삭제', style: 'destructive', onPress: () => deleteProfile(p.id) }])}>
              <Text style={{ color: C.danger }}>삭제</Text>
            </Pressable>
          )}
        </View>
      ))}
      <View style={s.card}>
        <TextInput style={s.name} placeholder="새 프로필 이름 (예: 가족, 회사)" value={name} onChangeText={setName} onSubmitEditing={add} />
        <Pressable onPress={add}><Text style={{ color: C.primary, fontWeight: '700' }}>추가</Text></Pressable>
      </View>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  hint: { color: C.sub, fontSize: 13 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, padding: 12, borderRadius: 12 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  name: { flex: 1, fontSize: 16, color: C.text },
  sub: { fontSize: 11, color: C.sub },
});
