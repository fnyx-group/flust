# Google Play VpnService declaration

Notes for the declaration that every app using `VpnService` fills in the Play Console ([Content filter](../product/content-filter.md#store-requirements)). The category stays open until similar apps are compared.

## Proposed category

Device security, for a filter that blocks content on the device. Reasons:

1. The VPN filters DNS on the phone and blocks harmful domains, as a firewall or DNS filter does, and Quad9 also blocks malware domains.
2. People set the filter on themselves, on their own phone. Parental control describes a parent and a child, which flust is not.
3. No traffic other than DNS enters the tunnel, and nothing reaches a server of ours.

The alternative is parental control and content filtering. The choice waits for a look at what comparable self-blocking apps declare.

## Prominent disclosure

Shown in the app before Android's VPN dialog: in the onboarding step, and in a sheet on the filter screen whenever consent is missing ([0042](../decisions/0042-filter-onboarding-and-disclosure.md)). The person accepts with "Accepter et activer" or declines with "Plus tard".

French: « flust utilise le service VPN d'Android pour filtrer les recherches DNS de tout le téléphone, c'est-à-dire les noms des sites que tes apps ouvrent. Les sites bloqués sont arrêtés sur le téléphone. Les recherches autorisées partent chiffrées vers Quad9, qui répond à la place de ton opérateur. Rien d'autre ne passe par flust, aucune recherche n'est enregistrée et rien n'est partagé. »

English: "flust uses Android's VPN service to filter the DNS lookups of the whole phone, which are the names of the sites your apps open. Blocked sites are stopped on the phone. Allowed lookups go encrypted to Quad9, which answers them instead of your carrier. Nothing else goes through flust, no lookup is recorded and nothing is shared."

## Data safety

Answered honestly about allowed lookups:

- Data shared: yes. The names of the sites the phone looks up and allows, which are web browsing data, go to Quad9 with the phone's IP address, encrypted in transit over DNS over TLS. Quad9 is a service provider that resolves them on the person's behalf. Its policy is not to log client IP addresses; flust cannot verify it ([threat model](../security/threat-model.md)).
- Data collected by flust: none. Blocked lookups never leave the phone, no lookup is logged or kept, and flust has no server.
- Processed ephemerally: yes, each lookup only while it is answered.
- Required: only when the person turns the filter on. Without the filter, nothing is sent.
- Deletion: nothing to delete on our side.

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
