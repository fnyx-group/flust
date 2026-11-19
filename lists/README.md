# Filter lists

The domain lists of the Android content filter, compiled into the app at build. The design is in [Content filter](../docs/product/content-filter.md#lists), the rules in [0039](../docs/decisions/0039-filter-lists-and-licenses.md).

## Layout

- `sources/<name>/`: a list taken from another project, unchanged, with its upstream `LICENSE` and a `PROVENANCE` file. Only MIT, Unlicense and CC0 sources are allowed.
- `flust/`: our own lists. `ai-nudify.txt` holds only names that no source covers, so it can stay empty. Each entry is one domain with its source and the day it was checked:

      cloth-off.io    # aegis ai-adult, checked 2026-11-19

| File                                                                                      | Category                                                         |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `sources/shadowwhisperer/list`, `sources/sinfonietta/list`, `sources/4skinskywalker/list` | Adult                                                            |
| `sources/aegis/ai-adult`, `flust/ai-nudify.txt`                                           | AI nudify                                                        |
| `flust/ai-companions.txt`                                                                 | AI companions, which also leave the AI nudify category           |
| `sources/aegis/vpn`, `flust/bypass.txt`                                                   | Bypass, blocked in strict mode                                   |
| `flust/google-domains.txt`                                                                | Google's search domains, for SafeSearch                          |
| `flust/exceptions.txt`                                                                    | Removed from every blocking category, with every name under them |

Nothing else may sit in this folder: the check fails on any other file.

## What is blocked

Sites whose main purpose is adult content are blocked, not general platforms that hold some, as with Reddit and X. A general platform that a source lists goes into `flust/exceptions.txt` with that reason. AI companions built for sexual chat stay under AI nudify; only general companion apps go under AI companions.

## Never

oisd, HaGeZi, Bon-Appetit, StevenBlack and UT1 are never committed, compiled or copied, not even one domain. The check fails when any line of a provenance or a comment names one. Bypass names come from primary sources, such as Chromium's DoH provider list and provider documentation.

## Changing a list

- Add a domain to our own lists with its source and the date, in lowercase ASCII. Internationalized names go in Punycode.
- Remove a domain wrongly blocked by a source by adding it to `flust/exceptions.txt`, with the reason. The filter also matches a name's parents, so the build fails on an exception under a name that stays blocked. Sources are never edited by hand: their checksum would no longer match.
- Update a source to its latest commit:

      scripts/update-list-source.sh shadowwhisperer

  The script rewrites the files, `LICENSE` and `PROVENANCE`. Read the diff of the license before opening the pull request.

## Checking and building

`pnpm test` checks the layout, the licenses, the provenance and the checksums, and builds the committed lists. To see the sizes and what each source brings:

    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-lists.ts --out /tmp/filter-lists.bin

The filter module's Gradle build runs the same script in the development build, so the compiled file is never committed.
