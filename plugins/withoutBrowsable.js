// 앱 주소(calendarapp://)의 인텐트 필터에서 BROWSABLE 을 뺀다.
// BROWSABLE 이 있으면 웹 페이지의 링크가 이 주소로 앱을 열 수 있어, 비서 명령(일정 등록·수정·삭제)을 웹이 몰래 보낼 수 있다.
// 구글 로그인 리디렉션(com.googleusercontent.apps.*)은 브라우저에서 돌아오므로 BROWSABLE 이 꼭 필요하다.
// Expo 는 두 스킴을 한 필터에 담으므로, 필터를 둘로 나눠 calendarapp 쪽에서만 BROWSABLE 을 뺀다.
const { withAndroidManifest } = require('@expo/config-plugins');

const BROWSABLE = 'android.intent.category.BROWSABLE';

module.exports = (config, { scheme } = {}) =>
  withAndroidManifest(config, (c) => {
    const target = scheme ?? (Array.isArray(c.scheme) ? c.scheme[0] : c.scheme);
    for (const activity of c.modResults.manifest.application?.[0]?.activity ?? []) {
      const out = [];
      for (const f of activity['intent-filter'] ?? []) {
        const datas = f.data ?? [];
        const mine = datas.filter((d) => d.$?.['android:scheme'] === target);
        if (!mine.length) { out.push(f); continue; }
        const others = datas.filter((d) => d.$?.['android:scheme'] !== target);
        // 내 스킴만 담은 필터: BROWSABLE 제거
        out.push({ ...f, category: (f.category ?? []).filter((x) => x.$?.['android:name'] !== BROWSABLE), data: mine });
        // 나머지 스킴(구글 로그인 등)은 원래 필터 그대로
        if (others.length) out.push({ ...f, data: others });
      }
      if (activity['intent-filter']) activity['intent-filter'] = out;
    }
    return c;
  });
