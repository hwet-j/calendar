import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { R, Theme, useTheme } from '../components/theme';
import { Button, Row, Section } from '../components/ui';
import { ThemePicker } from '../components/ThemePicker';
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
  const t = useTheme();
  const st = useMemo(() => styles(t), [t]);
  const insets = useSafeAreaInsets();
  const { state, shown, setGoogle, replaceEvents, importEvents, setShowLunar, setTheme } = useStore();
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

  const sync = async () => {
    setBusy(true);
    try {
      const token = await G.freshAccessToken();
      if (!token) { setGoogle({ connected: false }); return Alert.alert('다시 로그인해 주세요'); }
      // 1) 구글에 없거나(신규) 구글에 반영 못 한(수정) 로컬 일정을 먼저 올리고  2) 구글 일정을 가져와 병합
      const local = [...state.events];
      let failed = 0;
      const problems: string[] = [];
      for (let i = 0; i < local.length; i++) {
        if (local[i].googleId && !local[i].pendingSync) continue;
        try {
          const r = await G.pushEvent(token, local[i]);
          local[i] = { ...local[i], googleId: r.id, pendingSync: r.problems.length > 0 };
          if (r.problems.length) { failed++; problems.push(`${local[i].title}: ${r.problems.join(', ')}`); }
        } catch { failed++; local[i] = { ...local[i], pendingSync: true }; }
      }
      const profileId = state.activeProfileId ?? state.profiles[0].id;
      const range = G.pullRange();
      const pulled = await G.pullEvents(token, profileId, uid, local, range);
      replaceEvents(G.mergePulled(local, pulled, range));
      setGoogle({ ...state.google, connected: true, lastSync: new Date().toISOString() });
      Alert.alert(failed ? '일부만 동기화됐어요' : '동기화 완료', failed ? `구글에 완전히 반영하지 못한 일정이 ${failed}개 있어요. 기기에는 그대로 남아 있고 다음 동기화 때 다시 시도해요.${problems.length ? '\n\n' + problems.slice(0, 3).join('\n') : ''}` : `구글 일정 ${pulled.length}개를 반영했어요.`);
    } catch (e) { Alert.alert('동기화 실패', String(e)); } finally { setBusy(false); }
  };

  const disconnect = async () => { await G.saveToken(null); setGoogle({ connected: false }); };
  const doImport = async () => {
    const list = await pickAndImport(state.activeProfileId ?? state.profiles[0].id);
    if (list.length) { importEvents(list); Alert.alert(`${list.length}개 일정을 가져왔어요`); }
  };

  const connected = state.google.connected;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: insets.bottom + 24 }}>
      <View style={st.hero}>
        <View style={st.gIcon}><Ionicons name="logo-google" size={22} color={t.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={st.heroT}>구글 캘린더</Text>
          <Text style={st.heroS}>
            {connected ? `연결됨${state.google.email ? ` · ${state.google.email}` : ''}` : '연결하면 구글 일정과 양방향으로 동기화돼요'}
          </Text>
          {state.google.lastSync && <Text style={st.heroS}>마지막 동기화 {new Date(state.google.lastSync).toLocaleString('ko-KR')}</Text>}
        </View>
      </View>
      {connected ? (
        <View style={{ gap: 8 }}>
          <Button text={busy ? '동기화 중…' : '지금 동기화'} icon="sync-outline" onPress={sync} disabled={busy} />
          <Button text="연결 해제" kind="danger" onPress={disconnect} />
        </View>
      ) : <Button text="구글 계정으로 연결" icon="logo-google" onPress={connect} disabled={!request} />}

      <Section title="화면 테마">
        <ThemePicker value={state.theme ?? 'system'} onChange={setTheme} />
      </Section>
      <Text style={st.note}>앱과 홈 위젯에 함께 적용돼요. 블랙은 완전한 검정 배경이라 OLED 화면에서 눈이 편하고 배터리도 아껴요.</Text>

      <Section title="표시">
        <Row icon="moon-outline" label="달력에 음력 표시" last
          right={<Switch value={!!state.showLunar} onValueChange={setShowLunar} trackColor={{ true: t.primary }} />} />
      </Section>

      <Section title="일정 공유">
        <Row icon="share-outline" label={`현재 보기 내보내기 (${shown.length}개)`} onPress={() => shareEvents(shown)} right={<Ionicons name="chevron-forward" size={18} color={t.faint} />} />
        <Row icon="download-outline" label=".ics 파일 가져오기" onPress={doImport} last right={<Ionicons name="chevron-forward" size={18} color={t.faint} />} />
      </Section>
      <Text style={st.note}>일정 상세에서 친구 이메일을 추가하면, 구글 연결 시 구글 캘린더가 초대를 보내 공유돼요. 내보낸 .ics 파일은 메신저·메일로 보내면 받는 사람이 자기 캘린더로 열 수 있어요.</Text>

      <Section title="알림 · 위젯">
        <Row icon="notifications-outline" label="일정 알림" right={<Text style={st.val}>일정별 설정</Text>} />
        <Row icon="apps-outline" label="홈 위젯" last right={<Text style={st.val}>{Platform.OS === 'android' ? '길게 눌러 추가' : 'iOS 준비 중'}</Text>} />
      </Section>
      <Text style={st.note}>안드로이드: 홈 화면을 길게 누르고 위젯에서 "오늘의 일정"을 추가하세요. 홈에서 선택한 프로필(또는 전체)이 그대로 표시돼요.</Text>

      <Text style={[st.note, { textAlign: 'center' }]}>v{Constants.expoConfig?.version}</Text>
    </ScrollView>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.card, borderRadius: R.md, padding: 16, boxShadow: t.shadow },
  gIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' },
  heroT: { fontSize: 17, fontWeight: '800', color: t.text },
  heroS: { fontSize: 13, color: t.sub, marginTop: 2 },
  note: { fontSize: 12, color: t.sub, lineHeight: 18, marginHorizontal: 6, marginTop: -8 },
  val: { fontSize: 14, color: t.sub },
});
