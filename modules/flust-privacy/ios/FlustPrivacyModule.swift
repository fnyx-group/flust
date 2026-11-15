import ExpoModulesCore

// CLOCK_MONOTONIC_RAW keeps counting while the phone sleeps, unlike the uptime clock behind
// performance.now(), and changing the date and time does not move it.
public class FlustPrivacyModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FlustPrivacy")

    Function("elapsedMs") { () -> Double in
      Double(clock_gettime_nsec_np(CLOCK_MONOTONIC_RAW)) / 1_000_000
    }
  }
}
