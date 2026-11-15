// Runs the module's plain Kotlin tests on the JVM, without the Android SDK: the wall time
// conversion and the rescheduling rules use only java.util. CI runs it (.github/workflows/ci.yml).
plugins {
  kotlin("jvm") version "2.2.0"
}

repositories {
  mavenCentral()
}

dependencies {
  testImplementation("junit:junit:4.13.2")
}

kotlin {
  sourceSets {
    main {
      kotlin.setSrcDirs(listOf("../android/src/main/java"))
      kotlin.include("**/WallTime.kt", "**/Reminder.kt")
    }
    test {
      kotlin.setSrcDirs(listOf("../android/src/test/java"))
      resources.setSrcDirs(listOf("../../../test/fixtures"))
    }
  }
}
