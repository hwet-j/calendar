/**
 * 구글 로그인(OAuth) 후 앱으로 돌아오는 주소인지 판별.
 * 예) com.googleusercontent.apps.<id>:/oauthredirect?code=...&state=...
 *     calendarapp:///oauthredirect?code=...
 * 이 주소는 화면 이동 요청이 아니므로 라우터가 처리하면 "Unmatched Route"가 뜬다.
 */
export const isOAuthRedirect = (path: string) =>
  /^com\.googleusercontent\.apps\./i.test(path) || /(^|[:/])oauthredirect([/?#]|$)/i.test(path);
