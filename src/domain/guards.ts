// Narrows a value read back from storage to one of a known list of literals.
export function isOneOf<T>(values: readonly T[]): (value: unknown) => value is T {
  return (value): value is T => (values as readonly unknown[]).includes(value);
}
