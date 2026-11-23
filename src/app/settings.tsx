import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import React, { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../components/theme';
import * as G from '../lib/google';
import { pickAndImport, shareEvents } from '../lib/share';
import { uid, useStore } from '../lib/store';

WebBrowser.maybeCompleteAuthSession();

// .env 에 EXPO_PUBLIC_GOOGLE_CLIENT_ID_{ANDROID,IOS,WEB} 설정 (README 참고)
const CLIENT_ID = Platform.select({
  android: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
});

export default function Settings() {
  const { state, shown, setGoogle, replaceEvents, importEvents } = useStore();
  const [busy, setBusy] = useState(false);
  const discovery = AuthSession.useAutoDiscovery('https://accounts.google.com');
  // 설치형 클라이언트는 "com.googleusercontent.apps.<id>:/oauthredirect" 형태의 역방향 스킴 사용
  const redirectUri = CLIENT_ID && Platform.OS !== 'web'
    ? `com.googleusercontent.apps.${CLIENT_ID.split('.apps.googleusercontent.com')[0]}:/oauthredirect`
    : AuthSession.makeRedirectUri();
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    { clientId: CLIENT_ID ?? '', scopes: G.GOOGLE_SCOPES, redirectUri, usePKCE: true, extraParams: { access_type: 'offline' } },
    discovery,
  );

  const connect = async () => {
    if (!CLIENT_ID) return Alert.alert('구글 클라이언트 ID가 필요해요', 'README의 "구글 연동 설정"을 따라 EXPO_PUBLIC_GOOGLE_CLIENT_ID_* 를 설정해 주세요.');
    const res = await promptAsync();
    if (res.type !== 'success' || !discovery || !request?.codeVerifier) return;
    const tok = await AuthSession.exchangeCodeAsync(
      { clientId: CLIENT_ID, code: res.params.code, redirectUri, extraParams: { code_verifier: request.codeVerifier } },
      discovery,
    );
    await G.saveToken({ accessToken: tok.accessToken, refreshToken: tok.refreshToken, expiresAt: Date.now() + (tok.expiresIn ?? 3600) * 1000 });
    const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.accessToken}` } }).then((r) => r.json()).catch(() => ({}));
    setGoogle({ connected: true, email: info.email });
  };

  const freshToken = async (): Promise<string | null> => {
    const t = await G.loadToken();
    if (!t) return null;
    if (t.expiresAt > Date.now() + 60000) return t.accessToken;
    if (!t.refreshToken || !discovery || !CLIENT_ID) return null;
    const r = await AuthSession.refreshAsync({ clientId: CLIENT_ID, refreshToken: t.refreshToken }, discovery);
    await G.saveToken({ accessToken: r.accessToken, refreshToken: r.refreshToken ?? t.refreshToken, expiresAt: Date.now() + (r.expiresIn ?? 3600) * 1000 });
    return r.accessToken;
  };

  const sync = async () => {
    setBusy(true);
    try {
      const token = await freshToken();
      if (!token) { setGoogle({ connected: false }); return Alert.alert('다시 로그인해 주세요'); }
      // 1) 아직 구글에 없는 로컬 일정을 올리고  2) 구글 일정을 가져와 병합
      const local = [...state.events];
      for (let i = 0; i < local.length; i++) {
        if (!local[i].googleId) local[i] = { ...local[i], googleId: await G.pushEvent(token, local[i]) };
      }
      const profileId = state.activeProfileId ?? state.profiles[0].id;
      const pulled = await G.pullEvents(token, profileId, uid, local);
      const pulledG = new Set(pulled.map((e) => e.googleId));
      replaceEvents([...local.filter((e) => !e.googleId || !pulledG.has(e.googleId)), ...pulled]);
      setGoogle({ ...state.google, connected: true, lastSync: new Date().toISOString() });
      Alert.alert('동기화 완료', `구글 일정 ${pulled.length}개를 반영했어요.`);
    } catch (e) { Alert.alert('동기화 실패', String(e)); } finally { setBusy(false); }
  };

  const disconnect = async () => { await G.saveToken(null); setGoogle({ connected: false }); };
  const doImport = async () => {
    const list = await pickAndImport(state.activeProfileId ?? state.profiles[0].id);
    if (list.length) { importEvents(list); Alert.alert(`${list.length}개 일정을 가져왔어요`); }
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card title="구글 캘린더 연동">
        <Text style={s.sub}>{state.google.connected ? `연결됨${state.google.email ? ` · ${state.google.email}` : ''}` : '연결되지 않음'}</Text>
        {state.google.lastSync && <Text style={s.sub}>마지막 동기화: {new Date(state.google.lastSync).toLocaleString('ko-KR')}</Text>}
        {state.google.connected ? (
          <View style={{ gap: 8 }}>
            <Btn t={busy ? '동기화 중…' : '지금 동기화 (양방향)'} onPress={sync} disabled={busy} />
            <Btn t="연결 해제" onPress={disconnect} ghost />
          </View>
        ) : <Btn t="구글 계정으로 연결" onPress={connect} disabled={!request} />}
      </Card>

      <Card title="일정 공유">
        <Text style={s.sub}>• 일정 상세에서 이메일을 추가하면 구글 캘린더 초대로 공유돼요.{'\n'}• .ics 파일로 내보내 메신저/메일로 보내면 받는 사람이 자기 캘린더로 열 수 있어요.</Text>
        <Btn t={`현재 보기의 일정 ${shown.length}개 내보내기 (.ics)`} onPress={() => shareEvents(shown)} />
        <Btn t=".ics 파일 가져오기" onPress={doImport} ghost />
      </Card>

      <Card title="알림 · 홈 위젯">
        <Text style={s.sub}>• 알림: 일정별로 설정한 시간에 기기 알림이 울려요 (반복 일정 포함).{'\n'}• 홈 위젯(안드로이드): 홈 화면 길게 누르기 → 위젯 → "오늘의 일정". 홈에서 고른 프로필(또는 전체)을 그대로 보여줘요.{Platform.OS === 'ios' ? '\n• iOS 위젯은 아직 지원되지 않아요.' : ''}</Text>
      </Card>
      <Text style={[s.sub, { textAlign: 'center' }]}>v{Constants.expoConfig?.version}</Text>
    </ScrollView>
  );
}

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={s.card}><Text style={s.h}>{title}</Text>{children}</View>
);
const Btn = ({ t, onPress, ghost, disabled }: { t: string; onPress: () => void; ghost?: boolean; disabled?: boolean }) => (
  <Pressable onPress={onPress} disabled={disabled} style={[s.btn, ghost && { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.primary }, disabled && { opacity: 0.5 }]}>
    <Text style={{ color: ghost ? C.primary : '#fff', fontWeight: '700' }}>{t}</Text>
  </Pressable>
);
const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, gap: 10 },
  h: { fontSize: 16, fontWeight: '700', color: C.text }, sub: { fontSize: 13, color: C.sub, lineHeight: 19 },
  btn: { backgroundColor: C.primary, padding: 12, borderRadius: 10, alignItems: 'center' },
});
