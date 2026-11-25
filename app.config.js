// app.json 위에 빌드 시점 설정을 덧붙입니다.
// 구글 로그인(OAuth) 후 앱으로 돌아오려면 "com.googleusercontent.apps.<클라이언트ID 앞부분>" 스킴이 앱에 등록돼야 합니다.
module.exports = ({ config }) => {
  const androidId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
  const iosId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;
  const reverse = (id) => `com.googleusercontent.apps.${id.replace('.apps.googleusercontent.com', '')}`;
  const schemes = [config.scheme, androidId && reverse(androidId), iosId && reverse(iosId)].filter(Boolean);
  return { ...config, scheme: schemes.length > 1 ? schemes : schemes[0] };
};
