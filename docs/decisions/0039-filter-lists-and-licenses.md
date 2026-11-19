# 0039 Filter lists and licenses

## Context

The filter needs large lists of adult domains ([0038](0038-content-filter.md)). The best known lists carry GPL or share-alike licenses, which would bind flust's code or the compiled file, and flust is under MPL-2.0 ([0003](0003-mpl-2-0-license.md)). The lists must also reach the app without a download at runtime ([0006](0006-no-network-access.md)).

## Decision

- Only sources under MIT, the Unlicense or CC0 are used: ShadowWhisperer, Sinfonietta, 4skinSkywalker and the ai-adult and VPN categories of aegis. Each sits in `lists/sources/<name>/` with its upstream license text and a `PROVENANCE` file: URL, commit, date, license, and the SHA-256 of each file.
- flust's own lists sit in `lists/flust/`: AI nudify sites, AI companions, encrypted DNS provider names, Google's search domains and exceptions. Every entry names its source and the day it was checked.
- oisd, HaGeZi, Bon-Appetit, StevenBlack and UT1 are never committed, compiled or copied.
- `scripts/build-lists.ts` checks the layout, the licenses and the checksums, fails on copyleft terms and on any provenance or comment naming an excluded list, then normalizes the domains to lowercase Punycode, removes the exceptions and writes one file: the first 8 bytes of each domain's SHA-256 and a byte of categories, sorted. The domains are not readable in the app.
- The filter module's Gradle build runs it in the builds that ship the filter, so the compiled file is never committed. `pnpm test` runs the check and builds the committed lists on every pull request.
- `scripts/update-list-source.sh` updates a source to its latest commit, and the change is reviewed like code.

## Consequences

- Lists change only with app updates.
- About 304,000 domains, 2.7 MB compiled. Two sources do not document where their domains come from; they stay for their coverage and explicit license.
- Two different domains sharing an 8-byte prefix would mix their categories. The build fails on such a collision.
- A domain copied by hand from an excluded list without naming it cannot be detected. Review of `lists/` changes covers it.
- The MIT texts are shown on a Licenses screen in lot 2.
