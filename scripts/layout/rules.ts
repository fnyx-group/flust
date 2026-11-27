// Reads the view hierarchy of one screen, as `maestro hierarchy` prints it, and lists what is
// clipped or overlaps (docs/decisions/0050-layout-matrix.md). The bounds are already clipped by the
// views around each node, and a node out of sight is left out, so a cut shows as a node that
// reaches the edge of what clips it, and a lost one cannot be seen at all: the flows assert what
// must show.

export type Box = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type LayoutNode = {
  readonly className: string;
  readonly text: string;
  readonly description: string;
  readonly clickable: boolean;
  readonly scrollable: boolean;
  readonly bounds: Box;
  readonly children: readonly LayoutNode[];
};

// In pixels: the bottom of the status bar and the top of the navigation bar.
export type Screen = {
  readonly width: number;
  readonly statusBarBottom: number;
  readonly navigationBarTop: number;
  readonly density: number;
};

type MaestroNode = {
  readonly attributes?: Readonly<Record<string, string | undefined>>;
  readonly children?: readonly MaestroNode[];
};

const BOUNDS = /^\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]$/;

// A text squashed below this height, in dp, has lost its line.
const MIN_TEXT_HEIGHT_DP = 8;

export function parseHierarchy(json: string): LayoutNode {
  return nodeOf(JSON.parse(json) as MaestroNode);
}

function nodeOf({ attributes = {}, children = [] }: MaestroNode): LayoutNode {
  const match = BOUNDS.exec(attributes.bounds ?? '');
  const [left = 0, top = 0, right = 0, bottom = 0] = match?.slice(1).map(Number) ?? [];
  return {
    className: attributes.class ?? '',
    text: attributes.text ?? '',
    description: attributes.accessibilityText ?? '',
    clickable: attributes.clickable === 'true',
    scrollable: attributes.scrollable === 'true',
    bounds: { left, top, right, bottom },
    children: children.map(nodeOf),
  };
}

type Placed = {
  readonly node: LayoutNode;
  readonly ancestors: readonly LayoutNode[];
  // Inside a view that scrolls: what it cuts can be scrolled to.
  readonly scrolls: boolean;
  readonly inTabBar: boolean;
};

function isText(node: LayoutNode): boolean {
  return node.className.endsWith('TextView') && node.text.trim() !== '';
}

function isContent(node: LayoutNode): boolean {
  return isText(node) || node.clickable;
}

function isScroller(node: LayoutNode): boolean {
  return node.scrollable && /ScrollView|RecyclerView|ListView/.test(node.className);
}

function labelOf(node: LayoutNode): string {
  const label = (node.text || node.description).replace(/\s+/g, ' ').trim();
  const shown = label === '' ? node.className.split('.').at(-1) : `"${label.slice(0, 60)}"`;
  const { left, top, right, bottom } = node.bounds;
  return `${shown} [${left},${top}][${right},${bottom}]`;
}

// The tab bar is the row of at least three clickable items of the same height that spans the
// width at the bottom. Its labels sit under the screen's content by design.
function tabBarOf(root: LayoutNode, screen: Screen): LayoutNode | null {
  let found: LayoutNode | null = null;
  visit(root, [], (candidate) => {
    const items = candidate.children.filter((child) => child.clickable);
    const first = items[0];
    if (items.length < 3 || first === undefined) return;
    const sameRow = items.every(
      (item) => item.bounds.top === first.bounds.top && item.bounds.bottom === first.bounds.bottom,
    );
    const left = Math.min(...items.map((item) => item.bounds.left));
    const right = Math.max(...items.map((item) => item.bounds.right));
    if (
      sameRow &&
      left <= 0 &&
      right >= screen.width &&
      first.bounds.bottom >= screen.navigationBarTop - 1
    ) {
      found = candidate;
    }
  });
  return found;
}

function hasSize(node: LayoutNode): boolean {
  return node.bounds.right > node.bounds.left && node.bounds.bottom > node.bounds.top;
}

function visit(
  node: LayoutNode,
  ancestors: LayoutNode[],
  each: (node: LayoutNode, ancestors: LayoutNode[]) => void,
) {
  each(node, ancestors);
  for (const child of node.children) visit(child, [...ancestors, node], each);
}

function placedNodes(root: LayoutNode, tabBar: LayoutNode | null): Placed[] {
  const placed: Placed[] = [];
  visit(root, [], (node, ancestors) => {
    placed.push({
      node,
      ancestors,
      scrolls: ancestors.some(isScroller),
      inTabBar: tabBar !== null && (node === tabBar || ancestors.includes(tabBar)),
    });
  });
  return placed;
}

// The hierarchy holds every window on screen, under nodes without bounds: the system bars' own
// windows are left out.
function appWindows(root: LayoutNode, screen: Screen): readonly LayoutNode[] {
  if (!hasSize(root)) return root.children.flatMap((child) => appWindows(child, screen));
  const { top, bottom } = root.bounds;
  return bottom > screen.statusBarBottom && top < screen.navigationBarTop ? [root] : [];
}

function overlap(a: Box, b: Box): { width: number; height: number } {
  return {
    width: Math.min(a.right, b.right) - Math.max(a.left, b.left),
    height: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top),
  };
}

export function layoutProblems(root: LayoutNode, screen: Screen): string[] {
  const dp = screen.density / 160;
  const tabBar = tabBarOf(root, screen);
  const floor = Math.min(screen.navigationBarTop, tabBar?.bounds.top ?? Infinity);
  const placed = appWindows(root, screen).flatMap((window) => placedNodes(window, tabBar));
  const problems: string[] = [];

  for (const { node, scrolls, inTabBar } of placed) {
    if (inTabBar) continue;
    if (isScroller(node) && node.bounds.bottom > floor) {
      problems.push(
        `${labelOf(node)} scrolls under the ${tabBar === null ? 'navigation bar' : 'tab bar'}`,
      );
    }
    if (isScroller(node) && node.bounds.top < screen.statusBarBottom) {
      problems.push(`${labelOf(node)} scrolls under the status bar`);
    }
    if (!isContent(node) || scrolls) continue;
    if (node.bounds.bottom >= floor) {
      problems.push(
        `${labelOf(node)} is cut at the bottom or under the ${tabBar === null ? 'navigation bar' : 'tab bar'}`,
      );
    }
    if (node.bounds.top < screen.statusBarBottom) {
      problems.push(`${labelOf(node)} is under the status bar`);
    }
    if (node.bounds.left <= 0 || node.bounds.right >= screen.width) {
      problems.push(`${labelOf(node)} is cut at the side`);
    }
  }

  for (const { node, scrolls } of placed) {
    if (
      !scrolls &&
      isText(node) &&
      node.bounds.bottom - node.bounds.top < MIN_TEXT_HEIGHT_DP * dp
    ) {
      problems.push(`${labelOf(node)} is squashed`);
    }
  }

  // Overlaps count only between nodes of which neither holds the other, by more than a dp each
  // way, so that touching edges and rounding pass.
  const content = placed.filter(
    ({ node, inTabBar }) => isContent(node) && !inTabBar && hasSize(node),
  );
  for (const [index, a] of content.entries()) {
    for (const b of content.slice(index + 1)) {
      if (b.ancestors.includes(a.node) || a.ancestors.includes(b.node)) continue;
      const { width, height } = overlap(a.node.bounds, b.node.bounds);
      if (width > dp && height > dp)
        problems.push(`${labelOf(a.node)} overlaps ${labelOf(b.node)}`);
    }
  }
  for (const { node } of placed) {
    if (node.clickable) problems.push(...brokenWords(node));
  }
  return problems;
}

function textsOf(node: LayoutNode): LayoutNode[] {
  return node.children.flatMap((child) => (isText(child) ? [child] : textsOf(child)));
}

function height({ top, bottom }: Box): number {
  return bottom - top;
}

// A label squeezed into a narrow column by the value beside it breaks inside its words. Within
// one control, a text of a single word that is half as tall again as the text beside it has
// wrapped: the texts of a row are close in size, and a word only wraps when it cannot fit.
function brokenWords(control: LayoutNode): string[] {
  const texts = textsOf(control);
  return texts.flatMap((word) => {
    if (/\s/.test(word.text.trim()) || !/\p{L}/u.test(word.text)) return [];
    const beside = texts.find(
      (other) =>
        other !== word &&
        (other.bounds.left >= word.bounds.right || other.bounds.right <= word.bounds.left) &&
        overlap(other.bounds, word.bounds).height > 0,
    );
    return beside !== undefined && height(word.bounds) > 1.5 * height(beside.bounds)
      ? [`${labelOf(word)} breaks inside its word beside ${labelOf(beside)}`]
      : [];
  });
}

// The content of the first view that scrolls, by label and position: two dumps around a swipe
// differ when it scrolled.
function scrolledContent(root: LayoutNode): string[] {
  let scroller: LayoutNode | null = null;
  visit(root, [], (node) => {
    if (scroller === null && isScroller(node)) scroller = node;
  });
  if (scroller === null) return [];
  const content: string[] = [];
  visit(scroller, [], (node) => {
    if (isContent(node)) content.push(labelOf(node));
  });
  return content;
}

export function scrolled(before: LayoutNode, after: LayoutNode): boolean {
  return scrolledContent(before).join('\n') !== scrolledContent(after).join('\n');
}
