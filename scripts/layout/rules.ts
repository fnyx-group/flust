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
  readonly hiddenFromScreenReaders: boolean;
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

// On one line, a word of the app's fonts has at most 3.7 letters per line height of width, as
// measured on every screen of the full matrix. Past this, its box is too narrow for it and it broke
// over lines.
const MAX_LETTERS_PER_LINE_HEIGHT = 4.2;

// Narrow letters, such as the rank numerals I and II, fit more than that: shorter words are not
// measured.
const MIN_MEASURED_WORD = 4;

// Within one control, texts of a row are close in size: a word half as tall again as the text
// beside it has wrapped.
const MAX_HEIGHT_BESIDE = 1.5;

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
    hiddenFromScreenReaders: attributes['important-for-accessibility'] === 'false',
    bounds: { left, top, right, bottom },
    children: children.map(nodeOf),
  };
}

type Placed = {
  readonly node: LayoutNode;
  readonly ancestors: readonly LayoutNode[];
  // The nearest view that cuts the node: the view that scrolls around it, or else its window.
  readonly clip: LayoutNode;
  // Inside a view that scrolls up and down: what it cuts at its top and bottom can be scrolled to.
  readonly scrolls: boolean;
  readonly inTabBar: boolean;
  // A control that covers its whole window, behind a sheet: it closes the sheet when tapped
  // outside it, and everything on the sheet lies over it by design.
  readonly backdrop: boolean;
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

function isSideways(node: LayoutNode): boolean {
  return node.className.endsWith('HorizontalScrollView');
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

function sameBox(a: Box, b: Box): boolean {
  return a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
}

function visit(
  node: LayoutNode,
  ancestors: LayoutNode[],
  each: (node: LayoutNode, ancestors: LayoutNode[]) => void,
) {
  each(node, ancestors);
  for (const child of node.children) visit(child, [...ancestors, node], each);
}

// The screen behind the lock screen stays in the hierarchy, drawn under the lock's opaque layer
// and hidden from screen readers: a layer that fills the window, with nothing in it a screen
// reader reaches, under a later sibling that holds something.
function coveredLayers(window: LayoutNode): ReadonlySet<LayoutNode> {
  const covered = new Set<LayoutNode>();
  visit(window, [], (node) => {
    node.children.forEach((child, index) => {
      const later = node.children.slice(index + 1);
      if (
        sameBox(child.bounds, window.bounds) &&
        allHidden(child) &&
        later.some((sibling) => !allHidden(sibling))
      ) {
        covered.add(child);
      }
    });
  });
  return covered;
}

function allHidden(node: LayoutNode): boolean {
  return node.hiddenFromScreenReaders && node.children.every(allHidden);
}

function placedNodes(window: LayoutNode, tabBar: LayoutNode | null): Placed[] {
  const covered = coveredLayers(window);
  const placed: Placed[] = [];
  visit(window, [], (node, ancestors) => {
    if (covered.has(node) || ancestors.some((ancestor) => covered.has(ancestor))) return;
    placed.push({
      node,
      ancestors,
      clip: ancestors.findLast(isScroller) ?? window,
      scrolls: ancestors.some((ancestor) => isScroller(ancestor) && !isSideways(ancestor)),
      inTabBar: tabBar !== null && (node === tabBar || ancestors.includes(tabBar)),
      backdrop: node !== window && node.clickable && sameBox(node.bounds, window.bounds),
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

// Outside a view that scrolls, the screen has margins: a node that reaches a side of its window is
// cut there. Inside one, controls and texts reach its sides by design, a chip starting a row as
// much as a text that fills its line, so a cut shows as a control whose label reaches the same
// side as the control: the padding around the label is gone. A label cut inside a control that
// keeps its padding, and a text cut on its own, are not seen here; a word cut short shows as a
// word too long for its box.
function cutAtSide({ node, clip }: Placed): boolean {
  if (isSideways(clip)) return false;
  const reaches = (box: Box, side: 'left' | 'right') =>
    side === 'left' ? box.left <= clip.bounds.left : box.right >= clip.bounds.right;
  if (!isScroller(clip)) return reaches(node.bounds, 'left') || reaches(node.bounds, 'right');
  if (!node.clickable) return false;
  const left = reaches(node.bounds, 'left');
  if (left === reaches(node.bounds, 'right')) return false;
  const side = left ? 'left' : 'right';
  return textsOf(node).some((label) => reaches(label.bounds, side));
}

// A text that the view scrolling it cuts at its top or bottom is partly scrolled out, not squashed.
function squashed({ node, clip, scrolls }: Placed, dp: number): boolean {
  if (!isText(node) || height(node.bounds) >= MIN_TEXT_HEIGHT_DP * dp) return false;
  if (!scrolls) return true;
  return node.bounds.top > clip.bounds.top && node.bounds.bottom < clip.bounds.bottom;
}

export type Exemptions = {
  // Names that may break anywhere, such as a project's on the licenses screen: a single long
  // proper noun has no other place to wrap.
  readonly unbreakable?: ReadonlySet<string>;
};

// A view that scrolls sideways shows part of what it cuts at its edges, such as the journal's
// prompt chips running off the screen: the part is not a box too narrow for its words.
function cutSideways({ node, clip }: Placed): boolean {
  return (
    isSideways(clip) &&
    (node.bounds.left <= clip.bounds.left || node.bounds.right >= clip.bounds.right)
  );
}

export function layoutProblems(
  root: LayoutNode,
  screen: Screen,
  { unbreakable = new Set() }: Exemptions = {},
): string[] {
  const dp = screen.density / 160;
  const tabBar = tabBarOf(root, screen);
  const floor = Math.min(screen.navigationBarTop, tabBar?.bounds.top ?? Infinity);
  const under = tabBar === null ? 'navigation bar' : 'tab bar';
  const placed = appWindows(root, screen)
    .flatMap((window) => placedNodes(window, tabBar))
    .filter(({ inTabBar, backdrop }) => !inTabBar && !backdrop);
  const problems: string[] = [];

  for (const place of placed) {
    const { node, scrolls } = place;
    if (isScroller(node) && node.bounds.bottom > floor) {
      problems.push(`${labelOf(node)} scrolls under the ${under}`);
    }
    if (isScroller(node) && node.bounds.top < screen.statusBarBottom) {
      problems.push(`${labelOf(node)} scrolls under the status bar`);
    }
    if (!isContent(node)) continue;
    if (!scrolls && node.bounds.bottom >= floor) {
      problems.push(`${labelOf(node)} is cut at the bottom or under the ${under}`);
    }
    if (!scrolls && node.bounds.top < screen.statusBarBottom) {
      problems.push(`${labelOf(node)} is under the status bar`);
    }
    if (cutAtSide(place)) problems.push(`${labelOf(node)} is cut at the side`);
  }

  for (const place of placed) {
    if (squashed(place, dp)) problems.push(`${labelOf(place.node)} is squashed`);
  }

  // Overlaps count only between nodes of which neither holds the other, by more than a dp each
  // way, so that touching edges and rounding pass.
  const content = placed.filter(({ node }) => isContent(node) && hasSize(node));
  for (const [index, a] of content.entries()) {
    for (const b of content.slice(index + 1)) {
      if (b.ancestors.includes(a.node) || a.ancestors.includes(b.node)) continue;
      const { width, height } = overlap(a.node.bounds, b.node.bounds);
      if (width > dp && height > dp)
        problems.push(`${labelOf(a.node)} overlaps ${labelOf(b.node)}`);
    }
  }

  // Texts already reported as broken, or that may break, are not compared with their neighbours.
  const settled = new Set<LayoutNode>();
  for (const place of placed) {
    if (!isText(place.node)) continue;
    if (cutSideways(place) || unbreakable.has(place.node.text.trim())) {
      settled.add(place.node);
    } else if (breaksInsideWord(place.node)) {
      settled.add(place.node);
      problems.push(`${labelOf(place.node)} breaks inside a word`);
    }
  }
  for (const { node } of placed) {
    if (node.clickable) problems.push(...brokenBeside(node, settled));
  }
  return problems;
}

function textsOf(node: LayoutNode): LayoutNode[] {
  return node.children.flatMap((child) => (isText(child) ? [child] : textsOf(child)));
}

function height({ top, bottom }: Box): number {
  return bottom - top;
}

function width({ left, right }: Box): number {
  return right - left;
}

// Android breaks lines at spaces, hyphens and slashes before it breaks a word.
function wordsOf(text: string): string[] {
  return text.split(/[\s/-]+/).filter((word) => word !== '');
}

// A text whose longest word gets fewer line heights of width than its letters need. The line height
// is not in the hierarchy: a text whose words are all whole has at most one line per word, so its
// height shared among its words is at most its line height. That estimate can miss a break in a
// text of several words, never report one that did not happen.
function breaksInsideWord(text: LayoutNode): boolean {
  const words = wordsOf(text.text);
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '');
  if (longest.length < MIN_MEASURED_WORD || !/\p{L}/u.test(longest)) return false;
  const lineHeight = height(text.bounds) / words.length;
  const room = width(text.bounds);
  return room > 0 && (longest.length * lineHeight) / room > MAX_LETTERS_PER_LINE_HEIGHT;
}

// A label squeezed into a narrow column by the value beside it, when it is too short to measure
// on its own: a single word that is taller than the text beside it, by more than texts of a row
// differ, has wrapped.
function brokenBeside(control: LayoutNode, settled: ReadonlySet<LayoutNode>): string[] {
  const texts = textsOf(control);
  return texts.flatMap((word) => {
    if (settled.has(word) || wordsOf(word.text).length !== 1 || !/\p{L}/u.test(word.text)) {
      return [];
    }
    const beside = texts.find(
      (other) =>
        other !== word &&
        (other.bounds.left >= word.bounds.right || other.bounds.right <= word.bounds.left) &&
        overlap(other.bounds, word.bounds).height > 0,
    );
    return beside !== undefined && height(word.bounds) > MAX_HEIGHT_BESIDE * height(beside.bounds)
      ? [`${labelOf(word)} breaks inside its word beside ${labelOf(beside)}`]
      : [];
  });
}

// The view that scrolls up and down and takes the most room: the screen's content.
function mainScroller(root: LayoutNode): LayoutNode | null {
  let main: LayoutNode | null = null;
  visit(root, [], (node) => {
    if (!isScroller(node) || isSideways(node) || !hasSize(node)) return;
    const area = width(node.bounds) * height(node.bounds);
    if (main === null || area > width(main.bounds) * height(main.bounds)) main = node;
  });
  return main;
}

export type Swipe = { readonly x: number; readonly fromY: number; readonly toY: number };

// An upward swipe inside the screen's content, from a fifth above its bottom to a fifth below its
// top. Starting anywhere else, such as on home's pinned buttons, would scroll nothing whatever the
// content's height.
export function swipeAcross(root: LayoutNode): Swipe | null {
  const scroller = mainScroller(root);
  if (scroller === null) return null;
  const { left, top, right, bottom } = scroller.bounds;
  const fifth = Math.round((bottom - top) / 5);
  return { x: Math.round((left + right) / 2), fromY: bottom - fifth, toY: top + fifth };
}

// Where the content of the screen's scrolling view sits. Only positions count: home's counter
// changes its words every minute without moving.
function scrolledContent(root: LayoutNode): number[] {
  const scroller = mainScroller(root);
  if (scroller === null) return [];
  const tops: number[] = [];
  visit(scroller, [], (node) => {
    if (isContent(node)) tops.push(node.bounds.top);
  });
  return tops;
}

export function scrolled(before: LayoutNode, after: LayoutNode): boolean {
  return scrolledContent(before).join(',') !== scrolledContent(after).join(',');
}
