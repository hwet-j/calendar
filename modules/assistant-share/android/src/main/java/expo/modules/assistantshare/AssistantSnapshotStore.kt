package expo.modules.assistantshare

import android.content.Context
import java.io.File

/** 스냅샷 파일 입출력. 쓰기는 임시 파일에 쓴 뒤 이름을 바꿔서, 읽는 쪽이 반쯤 쓰인 파일을 보지 않게 한다. */
object AssistantSnapshotStore {
  const val FILE_NAME = "assistant_snapshot.json"
  const val MAX_BYTES = 600 * 1024

  fun file(context: Context) = File(context.filesDir, FILE_NAME)

  /** 기록했으면 true. 너무 크면 기록하지 않고 false */
  fun write(context: Context, json: String): Boolean {
    val bytes = json.toByteArray(Charsets.UTF_8)
    if (bytes.size > MAX_BYTES) return false
    val target = file(context)
    val tmp = File(context.filesDir, "$FILE_NAME.tmp")
    tmp.writeBytes(bytes)
    if (!tmp.renameTo(target)) {
      target.delete()
      if (!tmp.renameTo(target)) {
        tmp.delete()
        return false
      }
    }
    return true
  }
}
