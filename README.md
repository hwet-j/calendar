# 캘린더 (Expo / React Native)

타임트리·구글 캘린더를 참고한 일정 관리 앱.

## 화면
| 홈 (라이트) | 홈 (다크) | 일정 | 프로필 |
|---|---|---|---|
| ![](docs/screenshots/home-light.png) | ![](docs/screenshots/home-dark.png) | ![](docs/screenshots/event.png) | ![](docs/screenshots/profiles.png) |

> 웹 렌더링(390×844)으로 캡처한 화면입니다. 다크 모드는 시스템 설정을 따라갑니다.

### 홈 위젯 (Android)
| 라이트 | 다크 | 작은 크기 |
|---|---|---|
| ![](docs/screenshots/widget-light-260.png) | ![](docs/screenshots/widget-dark-260.png) | ![](docs/screenshots/widget-light-150.png) |

> 위젯 트리를 HTML로 근사 렌더링한 미리보기라 실제 런처에서는 폰트/여백이 조금 다를 수 있어요. 일정 카드를 누르면 해당 일정이, `+`를 누르면 새 일정 화면이 열리고, 위젯 크기에 따라 보이는 일정 수가 달라져요.

## 기능
- **여러 프로필**: 프로필(나/가족/회사 …)별 색상·이름 관리. 홈 상단 칩으로 *프로필별 보기* 또는 *전체 보기* 전환, 전체 보기에 포함할 프로필은 개별 토글
- 월 달력 + 날짜별 일정 목록, 종일/기간/반복(매일·매주·매월·매년) 일정
- **알림**: 일정별 (정각/10분/30분/1시간/하루 전) 로컬 알림, 반복 일정 포함. 알림 탭 시 해당 일정으로 이동
- **홈 위젯 (Android)**: 선택한 프로필(또는 전체)의 오늘·내일 일정
- **구글 캘린더 연동**: OAuth(PKCE)로 로그인, 양방향 동기화(앱 ⇄ 기본 캘린더)
- **공유**: ① 일정에 이메일 추가 → 구글 캘린더 초대 발송 ② `.ics` 내보내기/가져오기(메신저·메일 공유 가능)

## 실행
```bash
npm install
npm test            # 핵심 로직 테스트
npm run typecheck
npx expo start      # Expo Go는 위젯/구글 로그인 제한 → 개발 빌드 권장
```
알림·위젯·구글 로그인은 네이티브 모듈이 필요하므로 개발 빌드로 실행하세요:
```bash
npx expo prebuild
npx expo run:android   # 또는 run:ios
```

## 구글 연동 설정
1. Google Cloud Console에서 프로젝트 생성 → **Google Calendar API** 사용 설정
2. OAuth 동의 화면 구성 (범위: `calendar.events`, 테스트 사용자 추가)
3. 사용자 인증 정보에서 **Android**(패키지 `com.hwetj.calendar` + SHA-1) / **iOS**(번들 ID `com.hwetj.calendar`) 클라이언트 ID 생성
4. `.env.example`을 `.env`로 복사해 클라이언트 ID 입력

## 구조
- `src/lib` 도메인 로직(날짜·반복 전개·프로필 필터·ICS·구글 API·알림·저장소) — `__tests__`에서 검증
- `src/app` Expo Router 화면 (홈, 일정 편집, 프로필, 설정)
- `src/widget` Android 홈 위젯 (`react-native-android-widget`)

## 알려진 한계 / 다음 단계
- iOS 홈 위젯 미구현 (`expo-widgets` 도입 예정)
- 앱 사용자끼리의 실시간 공유(자체 서버)는 미구현 — 현재는 구글 초대/.ics 방식
- 구글 동기화는 수동(설정 → 지금 동기화), 삭제 동기화는 앱에서 삭제 시에만 반영
- 시뮬레이터/실기기 UI 검증은 아직 못 했고, 타입체크·로직 테스트·Android 번들 빌드까지 확인함
