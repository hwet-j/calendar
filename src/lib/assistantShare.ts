import { requireOptionalNativeModule } from 'expo';

type Native = { writeSnapshot(json: string): boolean };

// 네이티브 모듈이 없는 환경(웹·테스트·구버전 빌드)에서는 아무 일도 하지 않는다.
const native = requireOptionalNativeModule<Native>('AssistantShare');

/** 비서가 백그라운드에서 읽을 수 있게 스냅샷 JSON 을 기록. 기록했으면 true */
export function writeAssistantSnapshot(json: string): boolean {
  try {
    return native ? native.writeSnapshot(json) : false;
  } catch {
    return false;
  }
}
