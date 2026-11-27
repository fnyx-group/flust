import { layoutProblems, parseHierarchy, scrolled, type Screen } from './rules';

// The emulator of the tests: 1080 by 2400 pixels at 420 dpi, with a 63 pixel status bar and a
// 63 pixel navigation bar.
const SCREEN: Screen = { width: 1080, statusBarBottom: 63, navigationBarTop: 2337, density: 420 };

type Spec = {
  class?: string;
  text?: string;
  desc?: string;
  clickable?: boolean;
  scrollable?: boolean;
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
    expect(
      problems(
        dump(
          {
            bounds: '[0,0][1080,2208]',
            children: [
              text('flust', '[118,163][341,268]'),
              scroll('[53,273][1028,1689]', [
                {
                  class: 'android.widget.Button',
                  desc: 'Série en cours',
                  clickable: true,
                  bounds: '[53,432][1028,1167]',
                  children: [
                    text('0', '[446,531][634,925]'),
                    text('heures', '[452,925][628,1009]'),
                  ],
                },
              ]),
              button('Check-in du jour', '[53,1721][1028,1837]', '[266,1748][898,1809]'),
              button("J'ai une envie", '[53,1857][1028,2009]', '[389,1897][692,1968]'),
              button("J'ai eu un écart", '[53,2030][1028,2156]', '[424,2063][656,2122]'),
            ],
          },
          TAB_BAR,
        ),
      ),
    ).toEqual([]);
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

  it('finds a label that breaks inside its word beside its value', () => {
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
    ).toEqual([
      '"Verrouillage" [298,1027][479,1305] breaks inside its word beside "Désactivé" [518,1116][837,1215]',
    ]);
    expect(
      problems(dump(row('Raisons et plans', '[298,456][621,644]', '1 plan', '[660,500][837,599]'))),
    ).toEqual([]);
    expect(
      problems(dump(row('Langue', '[298,1737][838,1874]', 'Français', '[298,1874][838,2010]'))),
    ).toEqual([]);
  });

  it('never compares a button with its own label', () => {
    expect(
      problems(dump(button('Continuer', '[53,1900][1028,2000]', '[400,1920][680,1980]'))),
    ).toEqual([]);
  });
});

describe('scrolled', () => {
  const before = parseHierarchy(
    dump(scroll('[53,273][1028,1689]', [text('0', '[446,531][634,925]')])),
  );

  it('is false when the content stays in place', () => {
    expect(
      scrolled(
        before,
        parseHierarchy(dump(scroll('[53,273][1028,1689]', [text('0', '[446,531][634,925]')]))),
      ),
    ).toBe(false);
  });

  it('is true when the content moved', () => {
    expect(
      scrolled(
        before,
        parseHierarchy(dump(scroll('[53,273][1028,1689]', [text('0', '[446,431][634,825]')]))),
      ),
    ).toBe(true);
  });
});
