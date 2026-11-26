// Runs the filter's plain Kotlin tests on the JVM, without the Android SDK: packets, DNS, the
// lists, the policy, the TCP responder and the TLS connection to the resolver use only the JDK.
// CI runs it (.github/workflows/ci.yml).
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
      kotlin.include(
        "**/Blocklist.kt",
        "**/CertificateCheck.kt",
        "**/DnsMessage.kt",
        "**/DotClient.kt",
        "**/FilterConfig.kt",
        "**/FilterEngine.kt",
        "**/FilterLists.kt",
        "**/FilterPolicy.kt",
        "**/FilterSettingsFile.kt",
        "**/NetworkChecks.kt",
        "**/PacketHandler.kt",
        "**/Packets.kt",
        "**/QueryProcessor.kt",
        "**/RestartDecision.kt",
        "**/Resolvers.kt",
        "**/ResolverTransport.kt",
        "**/SafeSearch.kt",
        "**/StartDecision.kt",
        "**/StopReason.kt",
        "**/TcpDnsResponder.kt",
        "**/TunnelRoutes.kt",
        "**/TunnelStarts.kt",
      )
    }
    test {
      kotlin.setSrcDirs(listOf("../android/src/test/java"))
      resources.setSrcDirs(listOf("../../../test/fixtures"))
    }
  }
}
