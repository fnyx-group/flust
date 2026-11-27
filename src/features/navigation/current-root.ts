import { useCallback, useEffect, useState } from 'react';

// The navigation roots that are mounted, oldest first. When Android recreates the activity, the
// new root mounts before the old one unmounts (docs/decisions/0048-router-per-root.md): a route
// taken by the old root would be lost with it, so only the latest root takes the routes that
// come from outside, a notification tap or the navigation held during the lock.
const roots: object[] = [];

export function registerRoot(root: object): () => void {
  roots.push(root);
  return () => {
    const index = roots.indexOf(root);
    if (index !== -1) roots.splice(index, 1);
  };
}

export function isCurrentRoot(root: object): boolean {
  return roots.at(-1) === root;
}

// Called once by the root layout, before the hooks that take outside routes: its effect runs
// first, so theirs already find the root registered. The returned function tells, at the time of
// a route, whether this root is the current one.
export function useCurrentRoot(): () => boolean {
  const [root] = useState(() => ({}));
  useEffect(() => registerRoot(root), [root]);
  return useCallback(() => isCurrentRoot(root), [root]);
}
