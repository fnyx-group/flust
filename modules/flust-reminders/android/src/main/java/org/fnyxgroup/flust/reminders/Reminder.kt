package org.fnyxgroup.flust.reminders

// One planned notification. A floating reminder keeps its wall time when the time zone changes
// and is converted again with the current zone; a fixed one keeps its instant.
data class Reminder(
  val id: Int,
  val body: String,
  val route: String,
  val wall: WallTime,
  val floating: Boolean,
  val at: Long,
)

// When each stored reminder should fire now, in order. Reminders whose time has passed, such as
// while the phone was off, are dropped rather than delivered late and all at once.
fun upcoming(reminders: List<Reminder>, now: Long, offsetAt: OffsetAt): List<Pair<Reminder, Long>> =
  reminders
    .map { reminder -> reminder to instantOf(reminder, offsetAt) }
    .filter { (_, instant) -> instant > now }
    .sortedBy { (_, instant) -> instant }

fun instantOf(reminder: Reminder, offsetAt: OffsetAt): Long =
  if (reminder.floating) reminder.wall.toInstant(offsetAt) else reminder.at

// The stored list after one reminder was delivered: it and anything already past are removed.
fun afterDelivery(reminders: List<Reminder>, deliveredId: Int, now: Long, offsetAt: OffsetAt): List<Reminder> =
  upcoming(reminders.filter { it.id != deliveredId }, now, offsetAt).map { (reminder, _) -> reminder }
