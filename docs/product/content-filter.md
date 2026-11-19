# Content filter

flust 0.2 adds a filter that blocks pornography and AI-generated pornography across the whole phone. It is built only from what Android and iOS provide. There is no server of ours, no subscription, and flust always says when the filter is not protecting.

This document records the design for both platforms. Android ships first. iPhone follows once the association has a paid Apple developer account. The decisions are [0038](../decisions/0038-content-filter.md) for the filter on both platforms, [0039](../decisions/0039-filter-lists-and-licenses.md) for the lists, [0033](../decisions/0033-android-filter-network-access.md) and [0041](../decisions/0041-filter-network-permissions.md) for the network access of the Android filter, [0040](../decisions/0040-filter-delay.md) for the delay, and [0042](../decisions/0042-filter-onboarding-and-disclosure.md) for the onboarding step and the disclosure.

## Principles

1. No one sees the browsing. There is no remote filtering service, and no query is logged, and no reference to a queried name is kept after its answer ([0033](../decisions/0033-android-filter-network-access.md)).
2. Anything that weakens the filter waits 20 minutes on the continuous clock ([0024](../decisions/0024-lock-wait.md)). Anything that strengthens it is immediate.
3. The filter stops the impulse, not a determined adult. A second phone or a factory reset will always get through, and flust says so.
4. The same lists on both platforms, under permissive licenses only.
5. One maintainer can keep it running. Network code stays small, lives in one module and is audited before release.
6. flust tells the truth. The app shows when the filter is inactive and why, and the website says what each platform allows.

## What people get

| Feature                                         | Android                                         | iPhone                                               |
| ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Controls in the app                             | Filter, Strict YouTube                          | Filter                                               |
| Adult sites                                     | Our lists, about 304,000 domains                | Apple's automatic adult filter                       |
| AI porn: nudify, deepfakes, sexual AI chat      | Our AI list                                     | Our 45 priority domains                              |
| SafeSearch on Google, Bing, DuckDuckGo, YouTube | Forced through DNS                              | Not available                                        |
| Browsers covered                                | Every app that uses the system DNS              | Every app that uses WebKit, to be checked one by one |
| Turning the filter off in flust                 | Waits 20 minutes                                | Waits 20 minutes                                     |
| One-step bypass                                 | Strict Private DNS, another VPN                 | Removing the Screen Time authorization with Face ID  |
| Bypass detected                                 | At once, the app shows filter inactive          | When flust is opened again                           |
| Blocking the removal of flust                   | Not possible without Device Owner               | Possible, off by default                             |
| What leaves the phone                           | Allowed DNS lookups, encrypted, to the resolver | Nothing                                              |

## Controls

The app has two switches and nothing more: Filter, and Strict YouTube on Android. While the filter is on, everything else is fixed: adult sites, AI porn (nudify, deepfakes, sexual AI chat), strict mode against bypasses, and SafeSearch on Google, Bing, DuckDuckGo and YouTube, moderate on YouTube and strict with the switch. Each extra switch would be a way to weaken the filter in a weak moment. The engine keeps its categories internally, for its tests and a later version.

Turning either switch on is immediate. Turning either off starts a 20-minute wait on the continuous clock, shown as a countdown that can be cancelled at any time. When it ends, flust asks for one last confirmation, and the request expires if it is not confirmed within 10 minutes. The wait survives a restart of the app, a change of the date and time, and a reboot, which never credits the time the phone was off ([0040](../decisions/0040-filter-delay.md)).

DNS has no equivalent of Strict YouTube for X, TikTok, Reddit or Instagram: none of them offers a restricted name to rewrite to. Blocking a whole network is a possible later feature, not part of V0.2.

## In the app

- Settings has a Filter row with its state: on, off or inactive. It opens the filter screen: the state at the top, with the reason and what to do when inactive and the request while it waits, then the two switches, one line on what the filter blocks, one line saying that allowed lookups go encrypted to Quad9, which also blocks malware, a help line for Chrome's secure DNS, and links to the always-on VPN setting and to the licenses of the lists.
- The onboarding presents the filter in a step of its own before the start point, with the disclosure in full, "Accepter et activer" and "Plus tard" ([0042](../decisions/0042-filter-onboarding-and-disclosure.md)).
- Turning the filter on from the filter screen shows the same disclosure in a sheet whenever Android's VPN dialog will follow.
- Home shows an inactive filter with a neutral chip, a shield and "Filtre inactif", in place of the circle name in the header row. It takes no height, so home keeps its fit at 667 points, and it opens the filter screen.
- About has a Licenses row with the license texts of the list sources.
- The iPhone shows none of this until lot 3.

### Inactive states

| State                                 | How flust knows                                                                 | What flust says and offers                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Strict Private DNS                    | A network with a Private DNS hostname, read with `ACCESS_NETWORK_STATE`         | Choose Automatic in the network settings, with a button that opens them        |
| Another VPN                           | The tunnel stopped while another app's VPN network exists                       | Android keeps one VPN at a time. Turn the filter back on, after the disclosure |
| Consent lost                          | Android's VPN consent no longer holds                                           | Turn the filter back on, after the disclosure                                  |
| VPN turned off in the system settings | The system revoked the tunnel                                                   | Turn the filter back on, and the always-on VPN link                            |
| Lists unreadable                      | The compiled lists failed to load                                               | Update flust or reinstall it. No button                                        |
| Start refused at boot                 | Android refused to start the service after a reboot. Not shown as an error      | The filter resumes when flust opens, and always-on avoids the wait             |
| Stopped                               | Any other stop, such as an error in the tunnel or the app stopped by the system | Turn the filter back on                                                        |

flust reads these when a screen comes into focus and when the app returns to the foreground, and every two seconds on the filter screen.

### Chrome's secure DNS

With secure DNS set to a custom provider, Chrome does not fall back to the system resolver: strict mode blocks the provider's name and the tunnel resets its address, so browsing in Chrome stops. The filter screen says to set it back to Automatic in Chrome's settings, Privacy and security, Use secure DNS.

## Android

A local VpnService that carries DNS only. It is the only way to apply our own lists to the whole phone without a server. The code is in `modules/flust-filter`.

### How it works

1. The VPN announces a fake DNS address, in IPv4 and IPv6, and routes only that address and the addresses of the major public resolvers into the tunnel. All other traffic never goes through flust. The resolver addresses are those of Chromium's list of DNS over HTTPS providers.
2. Each name is looked up in the compiled lists, then its parents (`video.example.com`, then `example.com`), in the categories that are switched on.
3. A blocked name gets NXDOMAIN.
4. An allowed name is sent over DNS over TLS to the resolver, with sockets marked by `protect()` so they leave the tunnel.
5. Queries arrive over UDP and over TCP. An answer too large for UDP is cut with the truncation flag, and the app asks again over TCP.
6. The service never touches the database or its key, and logs no query. It keeps no cache, and no reference to a queried name is kept after its answer: the system's own DNS cache does the rest. Its settings are encrypted under a key of their own.
7. Each change of the settings from the app sets up a new tunnel, then closes the one it replaces, so lookups never leave the filter in between. The two tunnels use different fake DNS addresses, and Android empties a network's DNS cache when its DNS servers change, so a stronger setting applies at once rather than when the cached answers expire.
8. DNS on port 53 to a fake address or to a routed resolver address is answered by flust. Other TCP connections to these addresses are reset at once and other UDP is dropped, so encrypted DNS to a known resolver fails fast and apps fall back to the system resolver. This does not depend on strict mode. A resolver missing from the list stays reachable.

Android's automatic Private DNS tries DNS over TLS to the VPN's DNS address first. The tunnel resets that connection at once, so Android falls back to plain DNS through the filter without waiting.

### Resolver

The default resolver is Quad9 at 9.9.9.9. It is run by a nonprofit foundation in Switzerland, does not log client IP addresses, and also blocks known malware domains, which the app states. Family resolvers can be offered later as options.

The module reaches Quad9 over DNS over TLS, on port 853, by its hard-coded IPv4 and IPv6 addresses. It never looks up the name `dns.quad9.net`, which strict mode blocks for every app along with the other DoH and DoT providers, and its sockets leave the tunnel through `protect()`, so the route that sends other apps' traffic to 9.9.9.9 into the tunnel does not apply to them. TLS still validates the certificate for `dns.quad9.net`, against the certificates that ship with Android only: a certificate authority added by the person or a device policy is not trusted. Tests check both that the name is blocked and that the resolver is reached.

Some networks block port 853. Lookups then fail, and the filter does not fall back to plain DNS. A DNS over HTTPS fallback on port 443 can be added later if the tests on real networks show it is needed.

DNS over TLS is an addition to [0033](../decisions/0033-android-filter-network-access.md). It brings TLS code into the module, which is part of the audit scope.

### Strict mode

On by default. It blocks the bypass category: the names of DoH and DoT providers, of VPN and proxy providers, and the Firefox canary domain. Its guard wins over user exceptions, so a user exception for a resolver name cannot reopen a bypass. Routing the public resolvers' addresses into the tunnel does not depend on it (step 8 of [How it works](#how-it-works)).

| Bypass                                    | What flust does                                                                                                                                                    | What stays open                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Browser DoH in Chrome, Edge, Brave, Opera | Blocks the bootstrap names of DoH providers. In automatic mode, Chromium only upgrades to DoH when the system resolver is on its list, and our fake address is not | DoH to a hand-typed IP address                        |
| Firefox DoH on by default                 | NXDOMAIN for the canary domain `use-application-dns.net`                                                                                                           | DoH turned on by hand, covered by the bootstrap names |
| Browser with a built-in VPN, proxy or Tor | Blocks VPN and proxy provider names from the bypass category                                                                                                       | Tor bridges and unknown proxies                       |

### SafeSearch

flust rewrites search engine names with a CNAME to their restricted version and resolves the target itself.

| Engine                                                 | Target                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Google, with Google's official per-country domain list | `forcesafesearch.google.com`                                                   |
| Bing                                                   | `strict.bing.com`                                                              |
| DuckDuckGo                                             | `safe.duckduckgo.com`                                                          |
| YouTube                                                | `restrictmoderate.youtube.com` by default, `restrict.youtube.com` as an option |

### Known limits

flust detects and shows these, with the reason and what to do.

1. Private DNS in strict mode sends lookups around the VPN. flust detects it and explains how to switch to Automatic. Refusing port 853 would break all resolution instead of filtering. Detecting it needs `ACCESS_NETWORK_STATE`, which the production build requests from lot 2 ([0041](../decisions/0041-filter-network-permissions.md)).
2. Another VPN app takes over, since Android runs one VPN at a time.
3. The VPN is turned off in the settings, or the app is force stopped. flust restarts the tunnel and guides people to the always-on VPN setting, which only they can enable.
4. Clear data in the Android settings resets the lock and the delay.
5. flust can be uninstalled. Nothing prevents it without Device Owner.

These are not detected.

1. An allowed name that is a CNAME to a blocked name still resolves, since flust matches the name asked, not the names in the resolver's answer.
2. A browser's own DNS cache, about a minute in Chrome, and connections already open, such as the YouTube app's, keep their answers after Strict YouTube is turned on. A new tunnel only empties Android's cache.
3. Chrome's secure DNS set to a custom provider stops browsing in Chrome rather than going around the filter. The filter screen explains how to set it back.

### Containment

These rules from [0033](../decisions/0033-android-filter-network-access.md) and [0030](../decisions/0030-production-android-permissions.md) apply.

1. Network code lives only in the filter's Kotlin module. The source scan allows network APIs there alone, each file only for its part. The lint rules, which read the TypeScript, stay as they are.
2. The filter opens sockets only to the resolver, from one file, and tests check it.
3. From lot 2, `INTERNET` and `ACCESS_NETWORK_STATE` are in the allowlist of `scripts/check-android-release.sh`, for the filter only. Every other blocked permission stays blocked. The release check fails on a build without the filter's VPN service, without one of these two permissions, or with any other VPN service ([0041](../decisions/0041-filter-network-permissions.md)).
4. An independent security audit of the filter takes place before the public release.

### Rejected

| Option                              | Why                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| Full tunnel                         | Much more network code, lower throughput                                                |
| Private DNS to a filtering resolver | A third party sees every lookup, it is turned off in two steps, no delay, not our lists |
| Accessibility service               | Reads the whole screen, strict Play policy, removed by Android's advanced protection    |
| Device Owner                        | Requires a factory reset                                                                |

## iPhone

Screen Time with individual authorization, available since iOS 16. There is no VPN and nothing leaves the phone.

### How it works

1. flust asks for the Screen Time authorization, confirmed with Face ID or the passcode.
2. flust turns on Apple's automatic adult filter and adds our domains.
3. Our domains are capped at 45 in code, with a test. Above about 49 domains, Screen Time stops blocking without any error. The 45 places go first to AI nudify sites, then to sites Apple's filter lets through in our tests.
4. On request, flust blocks its own removal. This is off by default, since developers report it can stay active after being turned off.
5. Turning the filter off in flust waits 20 minutes, as on Android.
6. At each launch, flust checks that the authorization is still granted, and shows filter inactive otherwise.

### Known limits

1. An adult can remove the authorization in the Settings with Face ID, without any delay. flust can only detect it when opened again, and suggest requiring the passcode instead of Face ID.
2. No forced SafeSearch, since there is no DNS to rewrite. What Apple's filter blocks in image results is measured during testing.
3. The coverage of Apple's automatic filter is unknown, AI sites included. It is measured on our test set.
4. Apps that do not use WebKit are not covered.

### Requirements

The Family Controls capability is not available to free personal teams, even in development. The iPhone work starts once the association has a paid Apple developer account, and distribution needs the Family Controls (Distribution) entitlement, requested from Apple.

### Rejected

| Option                                | Why                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------- |
| iOS 26 URL filter with a PIR server   | A server to host and monitor, an uncertain export entitlement. To revisit after 1.0 |
| Local VPN                             | Not meant for filtering, and it takes the only VPN slot                             |
| DNS settings to a resolver            | The resolver sees everything, against the promise of flust                          |
| Content filter or DNS proxy extension | Supervised devices and child accounts only                                          |
| Safari content blocker                | Safari only, turned off in one step                                                 |

## Lists

Permissive licenses only, committed in this repository and compiled at build. There is no download at runtime and no separate repository. Lists ship with app updates. [lists/README.md](../../lists/README.md) explains how to change them.

### Sources

| Source                             | Content                                                                                                       | Size                                                      | License   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------- |
| ShadowWhisperer                    | Adult sites, from its author's script and manual additions                                                    | 213,982 domains, 191,346 of them in no other adult source | Unlicense |
| Sinfonietta                        | Adult sites                                                                                                   | 61,155 domains, 32,245 in no other                        | MIT       |
| 4skinSkywalker                     | Adult sites                                                                                                   | 70,174 domains, 46,778 in no other                        | MIT       |
| aegis, ai-adult and VPN categories | AI adult sites, VPN and proxy providers                                                                       | 69 AI domains, 235 VPN domains                            | CC0       |
| flust AI list                      | AI nudify and deepfake sites no source covers. The known ones, such as Clothoff and DeepNude, come from aegis | Empty to start                                            | MPL-2.0   |
| flust bypass list                  | DoH and DoT providers from Chromium's and Firefox's provider lists, and the Firefox canary domain             | 37 names                                                  | MPL-2.0   |

Together 304,083 domains, 2.7 MB once compiled. The 20 large sites tested while designing the filter are all blocked. What is missing is mostly the long tail of small sites and mirrors, filled over time by our own lists and user reports. Sizes measured on 19 November 2026 by the build step.

Sinfonietta and 4skinSkywalker do not document their sources. They stay in, since their MIT license is explicit and without them two large sites tested get through.

The lists block sites whose main purpose is adult content, not general platforms that hold some, as with Reddit and X. The exceptions therefore take out `vk.com`, `ok.ru`, `4chan.org`, `9gag.com` and `deviantart.com`, which the MIT sources list. They also take out domains that aegis's VPN category lists but that carry far more than a VPN: antivirus vendors, whose updates and accounts use them, and `proton.me`, shared by Proton Mail, Drive and Pass. `protonvpn.com` stays blocked. The same rule takes out 16 general AI chat and companion apps that aegis's AI category lists, such as `character.ai`, `replika.com` and `novelai.net`: their main purpose is not sexual. Together the 33 exceptions remove 43 names.

AI chat built for sex, such as JanitorAI and chub.ai, stays blocked under AI porn. Lot 1 had a separate AI companions category, off by default. Lot 2 removed it with its list and its strings, and its domains became exceptions.

### Excluded

These are never committed, compiled or copied by hand. The check of the build step fails when any line of a source's provenance names one, when a license carries copyleft or share-alike terms, or when a comment in any list names one. A domain copied by hand without naming its origin cannot be told apart: every entry of our own lists carries its source, and review does the rest.

| Source       | Why                                                                          |
| ------------ | ---------------------------------------------------------------------------- |
| oisd, HaGeZi | GPL-3.0                                                                      |
| Bon-Appetit  | CC BY-SA 4.0, share-alike                                                    |
| StevenBlack  | Its sources have mixed licenses, and 97% of its porn list is already covered |
| UT1          | About 4.6 million domains, too large for the app                             |

The bypass list is written from primary sources, such as provider documentation and Chromium's DoH provider list, never from HaGeZi.

### Layout

```
lists/
  README.md
  sources/
    shadowwhisperer/   list, LICENSE, PROVENANCE
    sinfonietta/       list, LICENSE, PROVENANCE
    4skinskywalker/    list, LICENSE, PROVENANCE
    aegis/             ai-adult, vpn, LICENSE, PROVENANCE
  flust/
    ai-nudify.txt
    bypass.txt
    exceptions.txt
    google-domains.txt
```

`PROVENANCE` holds the source URL, the commit, the date, the license and, for each file, its path upstream and its SHA-256. Our own lists hold one domain per line, with its source and the date it was checked in a comment.

```
cloth-off.io    # aegis ai-adult, checked 2026-11-19
```

An exception removes a domain and every name under it from the blocking categories. Since the filter also matches a name's parents, the build fails on an exception under a name that stays blocked: it would unblock nothing.

### Categories

| Category  | While the filter is on | Platforms                              |
| --------- | ---------------------- | -------------------------------------- |
| Adult     | Always blocked         | Android, iPhone through Apple's filter |
| AI nudify | Always blocked         | Android, iPhone within the 45 domains  |
| Bypass    | Always blocked         | Android, as strict mode                |

### Build step

`scripts/build-lists.ts`, run by the filter module's Gradle build in the builds that ship the filter:

1. Check the layout, the licenses and the provenance, and fail if a source has no permissive license file, or if anything comes from an excluded list.
2. Read every list, lowercase it, convert it to Punycode, drop invalid entries and duplicates, and remove the exceptions.
3. Sort each domain into its category.
4. Write one compact file into the APK: the first 8 bytes of each domain's SHA-256, with a byte of categories, sorted for a binary search. The domains themselves are not readable in the app.
5. Select the 45 iPhone domains, with lot 3.

`pnpm test` runs the same check on every pull request.

Every build compiles the lists from lot 2, so `lists/`, `scripts/lists/` and `scripts/build-lists.ts` trigger the native builds of [0037](../decisions/0037-ci-native-builds.md).

### Updating

`scripts/update-list-source.sh` fetches the latest version of a source and updates its `PROVENANCE`. The change is reviewed in a pull request like code. Our own lists change by adding a line with its source. A Licenses screen in About shows the license text of every source, and a test fails when a source's `LICENSE` changes until the app's copy follows.

## Delivery

| Lot            | Content                                                                                                                                                                                                                                                                                                                                        | Done when                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1, the engine  | This design in the repository, the lists and their build step, the Kotlin filter module, strict mode, SafeSearch, the release check that pairs `INTERNET` with the filter's VPN service, all behind a development setting                                                                                                                      | The filter blocks on the emulator behind a development setting |
| 2, the product | Onboarding step, settings screen, 20-minute delay, filter inactive states, `INTERNET` and the VPN service in the production build, the decision on `ACCESS_NETWORK_STATE`, `lists/` in the native build triggers, Maestro flows, Licenses screen, Play declaration, a start at boot that Android refuses shown as such rather than as an error | Someone who does not know the app turns the filter on alone    |
| 3, iPhone      | Screen Time module in Swift, the 45 domains, removal block, launch check, the same screens as lot 2                                                                                                                                                                                                                                            | The filter works on a test iPhone through TestFlight           |
| 4, the field   | The test plan on real phones, website wording per platform, store declarations, the lookup timeouts when Quad9 cannot be reached, where a queued query can wait about 12 seconds after its app gave up. Before the store release, the Licenses screen also covers the JavaScript and native dependencies shipped in the APK                    | Both platforms pass the test plan                              |

## Store requirements

Every app that uses VpnService fills a declaration in the Play Console, with an in-app disclosure shown before consent and two videos of 90 seconds or less, one of the VPN in use and one of the disclosure. [Google Play VpnService declaration](../release/google-play-vpn-declaration.md) holds the proposed category, the disclosure, the Data safety answers and the video scripts. The category stays open until comparable apps are compared.

On Apple's side, the association enrolls in the Apple Developer Program and asks for the fee waiver, then requests the Family Controls (Distribution) entitlement. Both take weeks and start as soon as the association is registered.

## Test plan

Real phones, with a fixed set of domains. It holds about a hundred common adult sites, the AI list, and the 500 most visited sites to find false positives. The emulator part of the Android plan is in the [manual checklist](../development/manual-checklist.md#content-filter-on-the-emulator).

### Android

1. Chrome, Firefox, Brave, Edge, Samsung Internet and Opera, each with DoH off, automatic and custom. Chrome with a custom provider stops browsing, and the help line says how to fix it.
2. Private DNS off, automatic and strict, and flust detects strict.
3. An app that queries 8.8.8.8 directly.
4. Another VPN app installed and turned on.
5. Reboot, force stop, Clear data, clock changed during the delay, reboot during the delay.
6. Wi-Fi, mobile data, an IPv6-only network, and a network that blocks port 853.
7. SafeSearch shows its restricted mode on Google, Bing, YouTube and DuckDuckGo.
8. The module opens sockets only to the resolver.
9. A day of normal use with no lost connection and no unusual battery drain.
10. The cost of loading the lists and of a lookup on a low-end phone.

### iPhone

1. Coverage of Apple's automatic filter on the test set, AI sites included, in Safari, Chrome, Firefox and the in-app browsers of Instagram and Reddit.
2. The filter keeps blocking at 45 domains.
3. Removing the authorization in the Settings, with and without Face ID, then detection when flust opens.
4. The removal block turned on, then off.

## References

1. [Google Play, VpnService policy](https://support.google.com/googleplay/android-developer/answer/12564964)
2. [Apple, What's new in Screen Time API, WWDC22](https://developer.apple.com/videos/play/wwdc2022/110336)
3. [Apple forums, web domain limit in Screen Time](https://developer.apple.com/forums/thread/730444)
4. [Apple forums, Family Controls needs a paid team](https://developer.apple.com/forums/thread/764682)
5. [Apple forums, Family Controls entitlement for distribution](https://developer.apple.com/forums/thread/829311)
6. [Quad9, how Quad9 handles your data](https://quad9.net/news/blog/how-quad9-handles-your-data-2025/)
7. [ShadowWhisperer block lists](https://github.com/ShadowWhisperer/BlockLists)
8. [aegis block list](https://github.com/0xDarkMatter/aegis-blocklist)
9. [Chromium, DoH provider list](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/net/dns/public/doh_provider_entry.cc)
10. [RFC 7858, DNS over TLS](https://www.rfc-editor.org/rfc/rfc7858)
