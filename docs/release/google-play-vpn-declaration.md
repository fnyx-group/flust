# Google Play VpnService declaration

Notes for the declaration that every app using `VpnService` fills in the Play Console ([Content filter](../product/content-filter.md#store-requirements)). The category stays open until similar apps are compared.

## Proposed category

Device security, for a filter that blocks content on the device. Reasons:

1. The VPN filters DNS on the phone and blocks harmful domains, as a firewall or DNS filter does, and Quad9 also blocks malware domains.
2. People set the filter on themselves, on their own phone. Parental control describes a parent and a child, which flust is not.
3. Only DNS is handled in the tunnel. The tunnel also takes the traffic to the addresses of known public DNS servers, so that apps cannot reach them directly: anything there other than DNS on port 53 is dropped or reset, never forwarded. All other traffic stays outside flust, and nothing reaches a server of ours.

The alternative is parental control and content filtering. The choice waits for a look at what comparable self-blocking apps declare.

## Prominent disclosure

Shown in the app before Android's VPN dialog: in the onboarding step, and in a sheet on the filter screen whenever consent is missing ([0042](../decisions/0042-filter-onboarding-and-disclosure.md)). The person accepts with "Accepter et activer" or declines with "Plus tard".

French: « flust utilise le service VPN d'Android pour filtrer les noms des sites que tes apps ouvrent, sur tout le téléphone. Les noms bloqués ne quittent pas le téléphone. Les noms des sites autorisés partent chiffrés vers Quad9, qui répond à la place de ton opérateur. Le reste de ton trafic ne passe pas par flust, sauf les connexions directes à des serveurs DNS publics connus, qui sont bloquées. flust n'enregistre rien. »

English: "flust uses Android's VPN service to filter the names of the sites your apps open, across the whole phone. Blocked names never leave the phone. The names of allowed sites go encrypted to Quad9, which answers instead of your carrier. The rest of your traffic does not go through flust, except direct connections to known public DNS servers, which are blocked. flust records nothing."

## Data safety

Play counts as collected any data the app sends off the device, including to a service provider, and as shared only data passed to a third party other than a service provider acting on the app's behalf. The filter sends the names of the allowed sites to Quad9, which resolves them for the person and nothing else, so:

- Data collected: yes, web browsing (the names of the allowed sites the phone looks up), only when the filter is on. They go to Quad9 with the phone's IP address. Blocked names never leave the phone.
- Data shared: no. Quad9 is a service provider that answers the lookups on the person's behalf. Its policy is not to log client IP addresses, which flust cannot verify ([threat model](../security/threat-model.md)).
- Processed ephemerally: yes. flust keeps no name after its answer and has no server. Quad9 uses each name only to answer it.
- Encrypted in transit: yes, DNS over TLS.
- Optional: the person chooses to turn the filter on. Without it, nothing is sent.
- Deletion: nothing is kept, so there is nothing to delete.

The final form wording is checked against the Play Console's current definitions before submission.

## Video scripts

Two videos of 90 seconds or less, on a clean emulator in French.

### The VPN in use

1. 0 to 10 s: open flust, Réglages, Filtre, state "Le filtre est désactivé.".
2. 10 to 30 s: turn Filtre on, the disclosure sheet, "Accepter et activer", Android's VPN dialog, OK, the key icon in the status bar.
3. 30 to 55 s: Chrome opens an adult site: blocked. A Google search shows SafeSearch locked on. Wikipedia loads.
4. 55 to 75 s: turn Filtre off: the 20-minute countdown, then "Annuler la demande".
5. 75 to 90 s: Android's VPN settings show flust as the VPN.

### The disclosure

1. 0 to 20 s: fresh install, the onboarding up to the filter step.
2. 20 to 50 s: scroll slowly through the disclosure in full.
3. 50 to 70 s: "Accepter et activer", then Android's VPN dialog appears only after it.
4. 70 to 90 s: the filter screen sheet, shown again when consent is missing.
