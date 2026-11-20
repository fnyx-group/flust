# 0045 Resolver chain of the Android filter

## Context

The Android filter forwarded every allowed lookup to Quad9 alone ([0033](0033-android-filter-network-access.md)). Quad9 stops answering people located in France on 24 November 2026, through a filter on their IP address. How it will refuse them is not known: a dropped connection, a refused one, a TLS failure or a `REFUSED` answer are all possible. With one resolver, the filter would stop resolving anything there.

A plain fallback to the system's resolver would send the names in clear and let the network answer around the filter. Trying a failed resolver before each query would add its timeout to every lookup.

## Decision

- The filter forwards to an ordered chain of three resolvers, each over DNS over TLS on port 853, at hard-coded addresses, with the certificate checked for its name against the certificates that ship with Android only, TLS 1.2 and later:
  1. Quad9, `dns.quad9.net`: 9.9.9.9, 149.112.112.112, 2620:fe::fe, 2620:fe::9.
  2. DNS4EU Protective, `protective.joindns4.eu`: 86.54.11.1, 86.54.11.201, 2a13:1001::86:54:11:1, 2a13:1001::86:54:11:201.
  3. Cloudflare's malware-blocking resolver, `security.cloudflare-dns.com`: 1.1.1.2, 1.0.0.2, 2606:4700:4700::1112, 2606:4700:4700::1002.

  The addresses and names were checked against each operator's documentation on 2026-11-20. All three block malware, so the protection does not change with the resolver. All their addresses are already among the public resolvers that the tunnel routes ([0038](0038-content-filter.md)).

- A resolver fails on a connect timeout, a refused or reset connection, a TLS or certificate failure, any other I/O error, or a `REFUSED` answer. `SERVFAIL`, `NXDOMAIN` and every other answer are final and go back to the app: a resolver that answers is never skipped.
- Each resolver is probed in the background, with a query for the root's name servers, when the tunnel starts and on every change of the phone's networks, seen through a network callback that compares the set of networks, so that the networks present at the start do not count as a change. A probe that started on the previous network does not count, and no probe starts for a resolver while one runs for it on the same network, so a start probes the chain once.
- A resolver that fails a query is marked failing and probed again at once in the background. A failed probe is followed by another after 30 seconds, 2 minutes and 10 minutes, then every hour; a network change starts the waits over. A resolver that passes a probe takes its place in the order again.
- A query goes to the first resolver that passed, then to the others that passed, then to those not probed yet. A resolver known to fail is never tried by a query. Before any probe finished, the chain is tried in order with a connect timeout of one second per resolver.
- When every resolver failed, the query gets `SERVFAIL` at once, and the chain is probed again in the background, at most every 30 seconds. Otherwise an outage longer than the first waits would leave the filter without DNS until the hourly probe.
- The connections to the resolvers are kept open and reused, as before ([0033](0033-android-filter-network-access.md)).
- There is no fallback to plain DNS or to the system's resolver. The sockets stay protected, the probes run off the main thread, and no query is logged.
- The code stays where [0033](0033-android-filter-network-access.md) put it: the endpoints in `Resolvers.kt`, formerly `Quad9.kt`, the sockets in `ResolverTransport.kt`, the chain in `DotClient.kt`.

## Consequences

- In France, from 24 November 2026, the allowed lookups go to DNS4EU, and to Cloudflare when DNS4EU fails too. Elsewhere they still go to Quad9.
- Three operators can see the allowed lookups, with the phone's IP address, instead of one. DNS4EU says its queries are anonymised and are not sold, profiled or used for advertising. Cloudflare truncates the client's address and deletes it, with its resolver logs, within 25 hours. The disclosure before the VPN consent names the three, in order, and no longer says that nothing is recorded.
- A resolver that fails once for a query comes back as soon as a probe passes, usually the one that starts at once. A failure of Quad9 that lasts sends lookups to DNS4EU until a probe passes: within 30 seconds, 2, 10 minutes or an hour, depending on how long it lasts.
- Each tunnel start and each network change costs one TLS connection per resolver.
- Strict mode still blocks the three names for every app. flust's own lookups go by address and are not affected.
