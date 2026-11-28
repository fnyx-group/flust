# Google Play VpnService declaration

Notes for the declaration that every app using `VpnService` fills in the Play Console ([Content filter](../product/content-filter.md#store-requirements)). The category stays open until similar apps are compared.

## Proposed category

Device security, for a filter that blocks content on the device. Reasons:

1. The VPN filters DNS on the phone and blocks harmful domains, as a firewall or DNS filter does, and its resolvers, Quad9, Cloudflare and DNS4EU, also block malware domains.
2. People set the filter on themselves, on their own phone. Parental control describes a parent and a child, which flust is not.
3. Only DNS is handled in the tunnel. The tunnel also takes the traffic to the addresses of known public DNS servers, so that apps cannot reach them directly: anything there other than DNS on port 53 is dropped or reset, never forwarded. All other traffic stays outside flust, and nothing reaches a server of ours.

The alternative is parental control and content filtering. The choice waits for a look at what comparable self-blocking apps declare.

## Prominent disclosure

Shown in the app before Android's VPN dialog: in the onboarding step, and in a sheet on the filter screen whenever consent is missing ([0042](../decisions/0042-filter-onboarding-and-disclosure.md)). The person accepts with "Accepter et activer" or declines with "Plus tard".

French: « flust utilise le VPN d'Android pour filtrer les noms des sites ouverts sur ce téléphone. Les noms bloqués ne quittent jamais le téléphone. Les autres partent chiffrés vers Quad9, ou vers Cloudflare puis DNS4EU quand Quad9 ne répond pas. Cloudflare efface les adresses IP anonymisées sous 25 heures. DNS4EU peut garder des données de requêtes jusqu'à six mois pour la recherche sur les menaces, sans les vendre ni s'en servir pour du profilage ou de la publicité. Le reste de ton trafic ne passe pas par flust, sauf les connexions directes à des DNS publics connus, qui sont bloquées. »

English: "flust uses Android's VPN to filter the names of the sites opened on this phone. Blocked names never leave the phone. The others go encrypted to Quad9, or to Cloudflare then DNS4EU when Quad9 does not answer. Cloudflare deletes anonymized IP addresses within 25 hours. DNS4EU can keep query data for up to six months for threat research, without selling it or using it for profiling or advertising. The rest of your traffic does not go through flust, except direct connections to known public DNS servers, which are blocked."

## Foreground service declaration

The VPN service runs in the foreground with the `systemExempted` type ([0047](../decisions/0047-filter-foreground-service.md)). Every app that targets Android 14 or later declares its foreground service types in the Play Console, on the App content page, besides this VpnService declaration ([Understanding foreground service and full-screen intent requirements](https://support.google.com/googleplay/android-developer/answer/13392821)). For each type, the form asks for a description of the feature, the impact on the person if Android defers or interrupts the task, a link to a video showing how the person starts the feature, and a use case from a preset list.

Play's foreground service policy exempts `systemExempted` from its criteria, that the task is started by the person, can be stopped by them, cannot be deferred and lasts only as long as needed ([Permissions for Foreground Services](https://support.google.com/googleplay/android-developer/answer/13315670)). It does not exempt the type from the declaration, and Play's table of types and use cases does not list it, so the use case is chosen in the Console at submission, from what it offers for this type.

Description: "flust's content filter is a local VPN that filters DNS lookups on the device, which the person turns on and off in the app. Its VpnService runs as a foreground service of the systemExempted type, which Android allows for VPN apps, so that the filter keeps running when the app is closed or swiped away from recents. Its notification is silent and hidden on the lock screen."

Impact if deferred or interrupted: "While the service is deferred or stopped, the filter does not run: sites the person chose to block load again on every app of the phone, without them knowing, until the filter starts again. Some manufacturers kill apps swiped away from recents, and without the foreground service the filter stopped there."

Video: the video of the VPN in use below, which shows the person turning the filter on, Android's VPN dialog, the filter blocking and the VPN in Android's settings. It is filmed with the notification permission granted before filming, since flust never asks for it, so that the silent notification shows once the filter is on.

## Data safety

Play counts as collected any data the app sends off the device, including to a service provider, and as shared only data passed to a third party other than a service provider acting on the app's behalf. The filter sends the names of the allowed sites to Quad9, or to Cloudflare then DNS4EU when Quad9 does not answer, which resolve them for the person and nothing else ([0045](../decisions/0045-resolver-chain.md)), so:

- Data collected: yes, web browsing (the names of the allowed sites the phone looks up), only when the filter is on. They go to the resolver that answers, with the phone's IP address. Blocked names never leave the phone.
- Data shared: no. Each resolver is a service provider that answers the lookups on the person's behalf. Quad9's policy is not to log client IP addresses, Cloudflare deletes the truncated addresses within 25 hours, and DNS4EU keeps some query data up to six months for threat research and says queries are not sold, profiled or used for advertising, which flust cannot verify ([threat model](../security/threat-model.md)). What each operator keeps, aggregates and passes to research or threat intelligence partners is in [Content filter](../product/content-filter.md#resolver).
- Processed ephemerally: yes. flust keeps no name after its answer and has no server. The resolvers use each name to answer it, under the policies above.
- Encrypted in transit: yes, DNS over TLS.
- Optional: the person chooses to turn the filter on. Without it, nothing is sent.
- Deletion: nothing is kept, so there is nothing to delete.

The final form wording is checked against the Play Console's current definitions before submission.

## Video scripts

Two videos of 90 seconds or less, on a clean emulator in French.

### The VPN in use

Before filming, grant flust the notification permission, which it never asks for the filter, so that the silent notification shows: `adb shell pm grant org.fnyxgroup.flust android.permission.POST_NOTIFICATIONS`. Without it, the service still runs in the foreground, but nothing shows in the shade.

1. 0 to 10 s: open flust, Réglages, Filtre, state "Le filtre est désactivé.".
2. 10 to 30 s: turn Filtre on, the disclosure sheet, "Accepter et activer", Android's VPN dialog, OK, the key icon in the status bar, and the silent notification "Actif en arrière-plan" in the shade.
3. 30 to 55 s: Chrome opens an adult site: blocked. A Google search shows SafeSearch locked on. Wikipedia loads.
4. 55 to 75 s: turn Filtre off: the 20-minute countdown, then "Annuler la demande".
5. 75 to 90 s: Android's VPN settings show flust as the VPN.

### The disclosure

1. 0 to 20 s: fresh install, the onboarding up to the filter step.
2. 20 to 50 s: scroll slowly through the disclosure in full.
3. 50 to 70 s: "Accepter et activer", then Android's VPN dialog appears only after it.
4. 70 to 90 s: the filter screen sheet, shown again when consent is missing.
