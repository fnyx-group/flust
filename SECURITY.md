# Security policy

## Supported versions

flust is pre-release. Only the `main` branch is supported.

## Reporting a vulnerability

Report vulnerabilities privately, preferably through
[GitHub private vulnerability reporting](https://github.com/fnyx-group/flust/security/advisories/new),
or by email to [security@fnyx-group.org](mailto:security@fnyx-group.org).

Never report vulnerabilities through public issues, pull requests or discussions.

Include:

- a description of the vulnerability
- the affected component
- steps to reproduce
- the impact
- a suggested fix, if any

## Response times

flust is a volunteer-run non-profit project. We aim to:

- acknowledge your report within 7 days
- provide an initial assessment within 30 days

## Coordinated disclosure

We fix the vulnerability first, then publish a security advisory and credit the reporter if they
wish. The default disclosure deadline is 90 days after the report, adjustable by mutual agreement.

## Scope

In scope:

- the mobile app code
- on-device data protection: encryption at rest, app lock
- content filtering bypasses
- the build and release pipeline
- this repository's CI

Out of scope:

- third-party services: GitHub, Expo, app stores
- social engineering
- physical access to an unlocked device
- denial of service

## Bug bounty

There is no bug bounty. flust is a non-profit project.

## Safe harbor

We will not take legal action against good-faith security research that follows this policy.
