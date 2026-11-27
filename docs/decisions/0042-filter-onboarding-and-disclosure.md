# 0042 Filter onboarding step and disclosure

## Context

Most people will only turn the filter on if the app presents it ([0038](0038-content-filter.md)). Google Play requires every app that uses `VpnService` to show a prominent disclosure inside the app before the system asks for consent: what is accessed, how it is used and whether it is shared, with an affirmative action to accept. The onboarding ([0012](0012-onboarding-flow.md)) ends with the start point, which finishes it in one transaction, and the iPhone filter only comes in lot 3.

## Decision

- A `filter` step sits between `plan` and `start`, only where the filter exists: Android for now. The step list and the progress depend on the platform (`src/domain/onboarding.ts`). A draft saved on `filter` where there is no filter resumes on `start`.
- The step shows what the filter blocks and the disclosure in full, then "Accepter et activer" and "Plus tard". Accepting opens Android's VPN dialog and starts the filter. "Plus tard" moves on with the filter off, and the filter stays in the settings.
- The filter's state lives in the filter module, apart from the onboarding answers: the step is not part of the draft or of the transaction that finishes the onboarding. A filter turned on and then left by going back stays on.
- The filter screen shows the same disclosure in a sheet before Android's dialog whenever consent is missing, including after another VPN took it. Declining is the first button, as in every sheet.
- The disclosure says that flust uses Android's VPN to filter the names of the sites opened on the phone, that blocked names never leave the phone, that the others go encrypted to Quad9, or else Cloudflare then DNS4EU, that Cloudflare deletes anonymized IP addresses within 25 hours, that DNS4EU can keep query data for up to six months against threats without selling it or profiling, and that the rest of the traffic does not go through flust except direct connections to public DNS servers, which are blocked ([0045](0045-resolver-chain.md)). It speaks of site names rather than lookups or searches, which read as web searches, and it does not say that nothing is shared or recorded: the names of allowed sites go to the resolvers.

## Consequences

- People who finished the onboarding with V0.1 never see the step. The filter is in the settings for them.
- The step has no switch to turn the filter off: once on, it shows that it is on and continues. Turning it off follows the delay of [0040](0040-filter-delay.md).
- The text of the disclosure is also the text of the Play declaration and of its video.
