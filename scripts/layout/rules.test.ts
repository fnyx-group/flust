import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { layoutProblems, parseHierarchy, scrolled, swipeAcross, type Screen } from './rules';

// The emulator of the tests: 1080 by 2400 pixels at 420 dpi, with a 63 pixel status bar and a
// 63 pixel navigation bar.
const SCREEN: Screen = { width: 1080, statusBarBottom: 63, navigationBarTop: 2337, density: 420 };

type Spec = {
  class?: string;
  text?: string;
  desc?: string;
  clickable?: boolean;
  scrollable?: boolean;
  hidden?: boolean;
  bounds: string;
  children?: Spec[];
};

// The attributes `maestro hierarchy` prints, for the ones the rules read.
function json(spec: Spec): object {
  return {
    attributes: {
      text: spec.text ?? '',
      accessibilityText: spec.desc ?? '',
      class: spec.class ?? 'android.view.ViewGroup',
      clickable: String(spec.clickable ?? false),
      scrollable: String(spec.scrollable ?? false),
      'important-for-accessibility': String(!(spec.hidden ?? false)),
      bounds: spec.bounds,
    },
    children: (spec.children ?? []).map(json),
  };
}

// The app's window, then the status bar's own window, which the rules leave out.
function dump(...children: Spec[]): string {
  const app: Spec = { class: 'android.widget.FrameLayout', bounds: '[0,0][1080,2400]', children };
  const statusBar: Spec = {
    class: 'android.widget.FrameLayout',
    bounds: '[0,0][1080,63]',
    children: [text('11:46', '[11,2][147,60]')],
  };
  const windows = {
    attributes: { ignoreBoundsFiltering: 'false' },
    children: [json(app), json(statusBar)],
  };
  return JSON.stringify({ attributes: {}, children: [windows] });
}

function text(label: string, bounds: string): Spec {
  return { class: 'android.widget.TextView', text: label, bounds };
}

function button(label: string, bounds: string, inner: string): Spec {
  return {
    class: 'android.widget.Button',
    desc: label,
    clickable: true,
    bounds,
    children: [text(label, inner)],
  };
}

function scroll(bounds: string, children: Spec[]): Spec {
  return {
    class: 'android.widget.ScrollView',
    scrollable: true,
    bounds,
    children: [{ bounds, children }],
  };
}

// As React Navigation lays out the bottom tabs: four items across the width, above the
// navigation bar, with the screen's content clipped at the top of the bar.
const TAB_BAR: Spec = {
  bounds: '[0,2208][1080,2400]',
  children: ['Accueil', 'Journal', 'Rangs', 'Réglages'].map((label, index) => ({
    class: 'android.view.View',
    desc: label,
    clickable: true,
    bounds: `[${index * 270},2211][${(index + 1) * 270},2337]`,
    children: [text(label, `[${index * 270 + 90},2297][${index * 270 + 180},2337]`)],
  })),
};

function problems(source: string): string[] {
  return layoutProblems(parseHierarchy(source), SCREEN);
}

// Home as laid out on the emulator, its content moved up by `scrolledBy` pixels.
function home(scrolledBy = 0, counter = 'Série en cours'): string {
  const top = (y: number) => y - scrolledBy;
  return dump(
    {
      bounds: '[0,0][1080,2208]',
      children: [
        text('flust', '[118,163][341,268]'),
        scroll('[53,273][1028,1689]', [
          {
            class: 'android.widget.Button',
            desc: counter,
            clickable: true,
            bounds: `[53,${Math.max(273, top(432))}][1028,${top(1167)}]`,
            children: [
              text('0', `[446,${Math.max(273, top(531))}][634,${top(925)}]`),
              text('heures', `[452,${top(925)}][628,${top(1009)}]`),
            ],
          },
        ]),
        button('Check-in du jour', '[53,1721][1028,1837]', '[266,1748][898,1809]'),
        button("J'ai une envie", '[53,1857][1028,2009]', '[389,1897][692,1968]'),
        button("J'ai eu un écart", '[53,2030][1028,2156]', '[424,2063][656,2122]'),
      ],
    },
    TAB_BAR,
  );
}

describe('parseHierarchy', () => {
  it('reads the nodes, their attributes and their nesting', () => {
    const root = parseHierarchy(
      dump(button("J'ai une envie", '[53,1857][1028,2009]', '[389,1897][692,1968]')),
    );
    const frame = root.children[0]?.children[0];
    expect(frame?.bounds).toEqual({ left: 0, top: 0, right: 1080, bottom: 2400 });
    const urge = frame?.children[0];
    expect(urge).toMatchObject({
      description: "J'ai une envie",
      clickable: true,
      scrollable: false,
    });
    expect(urge?.children[0]).toMatchObject({
      className: 'android.widget.TextView',
      text: "J'ai une envie",
    });
  });

  it('reads a text as written', () => {
    const root = parseHierarchy(
      dump(text("Idées noires\u202f? Parler à quelqu'un", '[53,100][500,160]')),
    );
    expect(root.children[0]?.children[0]?.children[0]?.text).toBe(
      "Idées noires\u202f? Parler à quelqu'un",
    );
  });
});

describe('layoutProblems', () => {
  it('passes the home screen as laid out on the emulator', () => {
    expect(problems(home())).toEqual([]);
  });

  it('finds a button cut by the tab bar', () => {
    expect(
      problems(
        dump(
          {
            bounds: '[0,0][1080,2208]',
            children: [button("J'ai eu un écart", '[53,2130][1028,2208]', '[424,2163][656,2208]')],
          },
          TAB_BAR,
        ),
      ),
    ).toEqual([
      '"J\'ai eu un écart" [53,2130][1028,2208] is cut at the bottom or under the tab bar',
      '"J\'ai eu un écart" [424,2163][656,2208] is cut at the bottom or under the tab bar',
    ]);
  });

  it('finds a text under the navigation bar on a screen without tabs', () => {
    expect(problems(dump(text('Annuler', '[400,2300][680,2400]')))).toEqual([
      '"Annuler" [400,2300][680,2400] is cut at the bottom or under the navigation bar',
    ]);
  });

  it('lets a text be cut by the view that scrolls it', () => {
    expect(
      problems(
        dump(scroll('[53,273][1028,2100]', [text('Une longue liste', '[53,2050][1028,2100]')])),
      ),
    ).toEqual([]);
  });

  it('finds a view that scrolls under the tab bar', () => {
    expect(
      problems(
        dump(
          { bounds: '[0,0][1080,2208]', children: [] },
          scroll('[53,273][1028,2300]', []),
          TAB_BAR,
        ),
      ),
    ).toEqual(['ScrollView [53,273][1028,2300] scrolls under the tab bar']);
  });

  it('finds a text under the status bar, and one cut at the side', () => {
    expect(
      problems(
        dump(
          text('Réglages', '[53,20][400,90]'),
          text('Une ligne trop large', '[53,300][1080,360]'),
        ),
      ),
    ).toEqual([
      '"Réglages" [53,20][400,90] is under the status bar',
      '"Une ligne trop large" [53,300][1080,360] is cut at the side',
    ]);
  });

  it('lets a view that scrolls cut a text down to a sliver', () => {
    expect(
      problems(dump(scroll('[53,273][1028,1933]', [text('Plus tard', '[53,1925][1028,1933]')]))),
    ).toEqual([]);
  });

  it('finds a button cut at the side', () => {
    expect(
      problems(dump(button('Langue, Français', '[550,208][1080,356]', '[698,213][1066,350]'))),
    ).toEqual(['"Langue, Français" [550,208][1080,356] is cut at the side']);
  });

  it('finds a squashed text', () => {
    expect(problems(dump(text('Note', '[53,300][400,315]')))).toEqual([
      '"Note" [53,300][400,315] is squashed',
    ]);
  });

  it('finds overlapping texts and buttons, but not touching ones', () => {
    expect(
      problems(
        dump(
          text('Langue', '[53,300][600,400]'),
          text('Français', '[500,330][1028,390]'),
          text('heures', '[53,400][600,460]'),
        ),
      ),
    ).toEqual(['"Langue" [53,300][600,400] overlaps "Français" [500,330][1028,390]']);
  });

  it('leaves out the screen behind the lock screen, but not a hidden layer on top', () => {
    const behind = (hidden: boolean): Spec => ({
      hidden: true,
      bounds: '[0,0][1080,2400]',
      children: [{ ...text('Après 5 min', '[210,1254][975,1315]'), hidden }],
    });
    const lock: Spec = {
      bounds: '[53,158][1028,2285]',
      children: [text('Verrouillé', '[484,1250][665,1311]')],
    };
    expect(problems(dump(behind(true), lock))).toEqual([]);
    expect(problems(dump(behind(false), lock))).toHaveLength(1);
    expect(problems(dump(lock, behind(true)))).toHaveLength(1);
  });

  it('finds a label that breaks inside a word beside its value', () => {
    const row = (label: string, labelBounds: string, value: string, valueBounds: string): Spec => ({
      class: 'android.widget.Button',
      desc: `${label}, ${value}`,
      clickable: true,
      bounds: '[68,980][1013,1353]',
      children: [text(label, labelBounds), text(value, valueBounds)],
    });
    expect(
      problems(
        dump(row('Verrouillage', '[298,1027][479,1305]', 'Désactivé', '[518,1116][837,1215]')),
      ),
    ).toEqual(['"Verrouillage" [298,1027][479,1305] breaks inside a word']);
    expect(
      problems(dump(row('Raisons et plans', '[298,456][621,644]', '1 plan', '[660,500][837,599]'))),
    ).toEqual([]);
    expect(
      problems(dump(row('Langue', '[298,1737][838,1874]', 'Français', '[298,1874][838,2010]'))),
    ).toEqual([]);
  });

  it('finds a control cut at the side by the view that scrolls it, with its label', () => {
    expect(
      problems(
        dump(
          scroll('[53,273][1028,2100]', [
            button('Améliorer ma concentration', '[600,400][1028,520]', '[640,430][1028,490]'),
          ]),
        ),
      ),
    ).toEqual(['"Améliorer ma concentration" [600,400][1028,520] is cut at the side']);
  });

  it('passes what reaches a side of the view that scrolls it by design', () => {
    expect(
      problems(
        dump(
          scroll('[53,273][1028,2100]', [
            text('Les connaître aide.', '[53,300][1028,360]'),
            button('Le soir au lit', '[53,400][420,520]', '[93,430][380,490]'),
            button('Langue, Français', '[700,560][1028,680]', '[740,590][988,650]'),
            text('Rien ne part sans toi.', '[160,720][1028,780]'),
          ]),
        ),
      ),
    ).toEqual([]);
  });

  it('lets a view that scrolls sideways cut its content at the side', () => {
    expect(
      problems(
        dump({
          class: 'android.widget.HorizontalScrollView',
          scrollable: true,
          bounds: '[53,300][1028,400]',
          children: [text('Le soir au lit', '[900,320][1028,380]')],
        }),
      ),
    ).toEqual([]);
  });

  it('finds a squashed text inside a view that scrolls', () => {
    expect(
      problems(dump(scroll('[53,273][1028,2100]', [text('Note', '[53,500][400,515]')]))),
    ).toEqual(['"Note" [53,500][400,515] is squashed']);
  });

  it('passes a sheet over the full window backdrop that closes it', () => {
    expect(
      problems(
        dump(
          {
            class: 'android.widget.Button',
            desc: 'Fermer',
            clickable: true,
            bounds: '[0,0][1080,2400]',
          },
          button('Français', '[53,1959][1028,2117]', '[210,2007][975,2071]'),
          button('Fermer', '[53,2158][1028,2284]', '[473,2191][607,2250]'),
        ),
      ),
    ).toEqual([]);
  });

  it('finds a word broken over lines on its own, as in a segmented control', () => {
    expect(problems(dump(text('Intense', '[807,1373][972,1561]')))).toEqual([
      '"Intense" [807,1373][972,1561] breaks inside a word',
    ]);
  });

  it('finds a word broken inside a label of several words', () => {
    expect(problems(dump(text('Raisons et plans', '[298,456][400,750]')))).toEqual([
      '"Raisons et plans" [298,456][400,750] breaks inside a word',
    ]);
  });

  it('passes words on one line, however narrow their letters, and names broken at hyphens', () => {
    expect(
      problems(
        dump(
          text('Filtre', '[298,900][396,959]'),
          text('II', '[58,1978][84,2049]'),
          text('@expo-google-fonts/barlow-condensed', '[90,2090][921,2235]'),
        ),
      ),
    ).toEqual([]);
  });

  it('finds a word half as tall again as the text beside it, and passes one exactly so', () => {
    const row = (labelBottom: number): Spec => ({
      class: 'android.widget.Button',
      clickable: true,
      bounds: '[53,300][1028,700]',
      children: [
        text('Langue', `[100,400][640,${400 + labelBottom}]`),
        text('Français', '[700,420][1000,520]'),
      ],
    });
    expect(problems(dump(row(150)))).toEqual([]);
    expect(problems(dump(row(151)))).toEqual([
      '"Langue" [100,400][640,551] breaks inside its word beside "Français" [700,420][1000,520]',
    ]);
  });

  it('lets a license name break, and only a name given as such', () => {
    const name = dump(text('ShadowWhisperer', '[136,1214][838,1477]'));
    expect(
      layoutProblems(parseHierarchy(name), SCREEN, { unbreakable: new Set(['ShadowWhisperer']) }),
    ).toEqual([]);
    expect(problems(name)).toEqual(['"ShadowWhisperer" [136,1214][838,1477] breaks inside a word']);
  });

  it('does not measure a chip that a view scrolling sideways shows only in part', () => {
    expect(
      problems(
        dump({
          class: 'android.widget.HorizontalScrollView',
          scrollable: true,
          bounds: '[1,2140][1080,2286]',
          children: [
            button('Une fierté du jour ?', '[1009,2140][1080,2286]', '[1058,2168][1080,2256]'),
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('never compares a button with its own label', () => {
    expect(
      problems(dump(button('Continuer', '[53,1900][1028,2000]', '[400,1920][680,1980]'))),
    ).toEqual([]);
  });
});

describe('swipeAcross', () => {
  it('swipes up inside the content of home, above its pinned buttons', () => {
    expect(swipeAcross(parseHierarchy(home()))).toEqual({ x: 541, fromY: 1406, toY: 556 });
  });

  it('has nothing to swipe on a screen that does not scroll', () => {
    expect(swipeAcross(parseHierarchy(dump(text('Annuler', '[400,300][680,400]'))))).toBeNull();
  });
});

describe('scrolled', () => {
  it('is false when the content stays in place, even when its words change', () => {
    expect(
      scrolled(parseHierarchy(home()), parseHierarchy(home(0, 'Série en cours, 1 minute'))),
    ).toBe(false);
  });

  it('is true when the content moved', () => {
    expect(scrolled(parseHierarchy(home()), parseHierarchy(home(100)))).toBe(true);
  });
});

describe('check-layout --unscrolled', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'check-layout-'));
  afterAll(() => fs.rmSync(folder, { recursive: true, force: true }));

  function checkLayout(...args: string[]) {
    const files = args.map((arg) => {
      if (!arg.startsWith('{')) return arg;
      const file = path.join(folder, `${fs.readdirSync(folder).length}.json`);
      fs.writeFileSync(file, arg);
      return file;
    });
    return spawnSync(
      process.execPath,
      [
        '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
        path.join(__dirname, '..', 'check-layout.ts'),
        '--width=1080',
        '--density=420',
        '--status-bar-bottom=63',
        '--navigation-bar-top=2337',
        ...files,
      ],
      { encoding: 'utf8' },
    );
  }

  it('fails when the swipe it prints scrolls home', () => {
    expect(checkLayout('--swipe', home()).stdout).toBe('541 1406 556\n');
    const result = checkLayout('--unscrolled', home(), home(250));
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/the screen scrolls, and it must fit without scrolling/);
  });

  it('passes when home stays in place', () => {
    expect(checkLayout('--unscrolled', home(), home()).status).toBe(0);
  });
});
