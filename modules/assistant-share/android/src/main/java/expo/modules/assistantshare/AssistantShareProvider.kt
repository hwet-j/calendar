package expo.modules.assistantshare

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri
import android.os.Binder
import android.os.Bundle

/**
 * 비서 앱 전용 읽기 전용 제공자. ContentResolver.call(authority, "snapshot") 하나만 지원한다.
 * - 호출자 패키지가 com.hwetj.assistant 가 아니면 "forbidden"
 * - query/insert/update/delete 는 전부 막혀 있어 다른 데이터는 노출되지 않는다
 */
class AssistantShareProvider : ContentProvider() {
  override fun onCreate() = true

  override fun call(method: String, arg: String?, extras: Bundle?): Bundle {
    val out = Bundle()
    val ctx = context
    if (ctx == null) {
      out.putString("error", "unavailable")
      return out
    }
    if (!callerAllowed()) {
      out.putString("error", "forbidden")
      return out
    }
    if (method != "snapshot") {
      out.putString("error", "unknown_method")
      return out
    }
    val f = AssistantSnapshotStore.file(ctx)
    if (!f.exists()) {
      out.putString("error", "no_snapshot")
      return out
    }
    return try {
      out.putString("json", f.readText(Charsets.UTF_8))
      out.putLong("ts", f.lastModified())
      out
    } catch (e: Exception) {
      Bundle().apply { putString("error", "read_failed") }
    }
  }

  private fun callerAllowed(): Boolean {
    if (callingPackage == ALLOWED) return true
    // callingPackage 가 null 일 수 있어 uid 로도 확인한다 (uid 는 위조할 수 없다)
    val pkgs = context?.packageManager?.getPackagesForUid(Binder.getCallingUid()) ?: return false
    return pkgs.contains(ALLOWED)
  }

  override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, values: ContentValues?): Uri? = null
  override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
  override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0

  companion object {
    const val ALLOWED = "com.hwetj.assistant"
  }
}
