# 0010 Domain errors as results

## Context

The domain layer validates user input such as a start date or a backdated lapse. Some of these inputs are expected to be wrong: a start date in the future, a lapse before the start. If domain functions threw for them, callers could forget a `try` and nothing in the type system would list the cases a screen has to handle.

## Decision

Functions in `src/domain/` do not throw for expected failures. They return a `Result` (`src/domain/result.ts`): `{ ok: true, value }` or `{ ok: false, error }`, where `error` is a union of string literals named after the function, such as `AddLapseError`.

Exceptions remain for programming errors only. Domain functions never read the clock: they take the current time, `now`, as an argument.

The rule is described in [Conventions](../development/conventions.md#errors).

## Consequences

- The type checker lists every error a caller must handle, and a new error case shows up at every call site.
- Error codes are stable strings that the feature layer maps to translated messages.
- Results add some ceremony at call sites, and tests unwrap them with a helper.
- Domain logic stays deterministic, because time is always passed in.
