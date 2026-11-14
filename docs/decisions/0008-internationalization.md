# 0008 Internationalization

## Context

flust is developed in French and English. Adding languages later is easier if no text is written directly in the code.

## Decision

- French and English are available at launch.
- All user-facing strings are externalized, including notifications, rank names and daily quotes.
- Unsupported system languages fall back to English.
- Plurals follow each language's rules. Dates and times follow the device locale, including 12 and 24 hour formats.

## Consequences

- Adding a language means adding a translation, without code changes.
- Layouts must allow longer strings, such as German, without truncation.
- Missing translations fall back to English instead of showing a key.
- Daily quotes must be written or translated in both languages.
