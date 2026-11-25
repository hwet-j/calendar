import { isOAuthRedirect } from '../lib/oauth';

/**
 * 앱으로 들어오는 외부 주소를 라우터가 해석하기 전에 가로챈다.
 * OAuth 리디렉션은 null로 돌려 라우터가 무시하게 한다 (로그인 결과는 expo-auth-session이 직접 받는다).
 * 알림 탭, calendarapp://event/<id> 같은 일반 딥링크는 그대로 통과.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string | null {
  return isOAuthRedirect(path) ? null : path;
}
