package expo.modules.assistantshare

import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** JS → 네이티브: 비서에게 보여줄 스냅샷 JSON 을 앱 내부 저장소에 기록한다. */
class AssistantShareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AssistantShare")

    Function("writeSnapshot") { json: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      AssistantSnapshotStore.write(context, json)
    }
  }
}
