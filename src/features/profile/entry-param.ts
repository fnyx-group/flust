export type EntryTarget = { kind: 'new' } | { kind: 'edit'; id: number } | { kind: 'invalid' };

// The reason and plan routes add an item without an id, and edit one with `?id=12`.
export function entryTarget(param: string | string[] | undefined): EntryTarget {
  if (param === undefined) return { kind: 'new' };
  if (typeof param !== 'string' || !/^[1-9][0-9]{0,15}$/.test(param)) return { kind: 'invalid' };
  const id = Number(param);
  return Number.isSafeInteger(id) ? { kind: 'edit', id } : { kind: 'invalid' };
}
