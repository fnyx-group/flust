package org.fnyxgroup.flust.reminders

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

// The planned list and the channel's name, kept in the no-backup directory so they never reach a
// backup. The text is the neutral notification wording, nothing from the user's data. The file
// is written whole to a temporary file and renamed, so an interrupted write never leaves half.
class ReminderStore(context: Context) {
  private val file = File(context.noBackupFilesDir, FILE_NAME)

  data class Contents(
    val reminders: List<Reminder>,
    val channelName: String,
    val channelDescription: String,
  )

  @Synchronized
  fun read(): Contents {
    if (!file.exists()) return EMPTY
    return try {
      decode(JSONObject(file.readText()))
    } catch (error: Exception) {
      EMPTY
    }
  }

  @Synchronized
  fun write(contents: Contents) {
    val temporary = File(file.parentFile, "$FILE_NAME.tmp")
    temporary.writeText(encode(contents).toString())
    if (!temporary.renameTo(file)) {
      file.delete()
      temporary.renameTo(file)
    }
  }

  private fun encode(contents: Contents): JSONObject {
    val reminders = JSONArray()
    contents.reminders.forEach { reminder ->
      reminders.put(
        JSONObject()
          .put("id", reminder.id)
          .put("body", reminder.body)
          .put("route", reminder.route)
          .put("year", reminder.wall.year)
          .put("month", reminder.wall.month)
          .put("day", reminder.wall.day)
          .put("hour", reminder.wall.hour)
          .put("minute", reminder.wall.minute)
          .put("floating", reminder.floating)
          .put("at", reminder.at),
      )
    }
    return JSONObject()
      .put("reminders", reminders)
      .put("channelName", contents.channelName)
      .put("channelDescription", contents.channelDescription)
  }

  private fun decode(json: JSONObject): Contents {
    val items = json.optJSONArray("reminders") ?: JSONArray()
    val reminders = (0 until items.length()).map { index ->
      val item = items.getJSONObject(index)
      Reminder(
        id = item.getInt("id"),
        body = item.getString("body"),
        route = item.getString("route"),
        wall = WallTime(
          item.getInt("year"),
          item.getInt("month"),
          item.getInt("day"),
          item.getInt("hour"),
          item.getInt("minute"),
        ),
        floating = item.getBoolean("floating"),
        at = item.getLong("at"),
      )
    }
    return Contents(
      reminders,
      json.optString("channelName", EMPTY.channelName),
      json.optString("channelDescription", EMPTY.channelDescription),
    )
  }

  companion object {
    private const val FILE_NAME = "flust-reminders.json"

    // Until the app has named the channel in the user's language.
    val EMPTY = Contents(emptyList(), "Reminders", "")
  }
}
