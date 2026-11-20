package org.fnyxgroup.flust.filter

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

// The fixture lists, compiled by scripts/build-lists.ts: test/fixtures/filter-lists/.
class BlocklistTest {
  private val lists = TestData.lists

  @Test
  fun readsTheEntriesOfTheCompiledFile() {
    assertEquals(12, lists.size)
    assertEquals(Categories.ADULT, lists.exact("adult.example"))
    assertEquals(Categories.AI_NUDIFY, lists.exact("nudify.example"))
    assertEquals(Categories.BYPASS, lists.exact("use-application-dns.net"))
    assertEquals(Categories.GOOGLE, lists.exact("google.fr"))
    assertEquals(Categories.ADULT, lists.exact("xn--bcher-kva.example"))
  }

  @Test
  fun findsNothingForANameOutsideTheLists() {
    assertEquals(0, lists.exact("example.org"))
    assertEquals(0, lists.categories("www.example.org"))
  }

  @Test
  fun matchesANameThroughItsParents() {
    assertEquals(Categories.ADULT, lists.categories("cdn.video.adult.example"))
    assertEquals(Categories.ADULT, lists.categories("adult-two.example"))
    assertEquals(0, lists.exact("www.adult.example"))
  }

  @Test
  fun neverMatchesAParentAboveTheListedName() {
    assertEquals(0, lists.categories("adult-three.example"))
    assertEquals(Categories.ADULT, lists.categories("www.adult-three.example"))
  }

  @Test
  fun leavesOutWhatTheExceptionsRemoved() {
    assertEquals(0, lists.categories("safe.excepted.example"))
    assertEquals(0, lists.categories("antivirus.example"))
    assertEquals(0, lists.categories("companion.example"))
  }

  @Test
  fun rejectsAFileThatIsNotACompiledList() {
    assertThrows(IllegalArgumentException::class.java) { Blocklist.read(ByteArray(4)) }
    assertThrows(IllegalArgumentException::class.java) { Blocklist.read("NOPE\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u0000".toByteArray()) }
    val truncated = TestData::class.java.getResourceAsStream("/filter-lists.bin")!!.use { it.readBytes() }.copyOf(20)
    assertThrows(IllegalArgumentException::class.java) { Blocklist.read(truncated) }
  }
}
