const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');
const globals = require('globals');

const sourceFiles = ['src/**/*.{ts,tsx}'];
const testFiles = ['**/*.test.{ts,tsx}'];
const themeFile = 'src/ui/theme.ts';
const scrollViewFile = 'src/ui/scroll-view.tsx';

const layers = ['app', 'features', 'data', 'domain', 'ui', 'lib'];

const reactAndExpoPackages =
  '^(react|react-dom|react-native|expo|i18next|react-i18next)(/|$)|^(react-native-|expo-|@expo/|@expo-google-fonts/|@react-native|@react-navigation/)';

const hexColor = '/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i';

const hexColorSyntax = [
  {
    selector: `Literal[value=${hexColor}]`,
    message: `Use a color from ${themeFile} instead of a hex literal.`,
  },
  {
    selector: `TemplateElement[value.raw=${hexColor}]`,
    message: `Use a color from ${themeFile} instead of a hex literal.`,
  },
];

const userFacingAttributes =
  'accessibilityLabel|accessibilityHint|aria-label|placeholder|title|label|alt';

// Punctuation and spacing alone, such as a separator, carry no translatable text.
const text = '/[\\p{L}\\p{N}]/u';
const message = 'Text must go through i18n: use t() from react-i18next.';
const literalText = `:matches(Literal[value=${text}], TemplateLiteral)`;
const userFacingAttribute = `JSXAttribute[name.name=/^(${userFacingAttributes})$/]`;

const literalTextSyntax = [
  { selector: `JSXText[value=${text}]`, message },
  {
    selector: `:matches(JSXElement, JSXFragment) > JSXExpressionContainer > ${literalText}`,
    message,
  },
  { selector: `${userFacingAttribute} > ${literalText}`, message },
  { selector: `${userFacingAttribute} > JSXExpressionContainer > ${literalText}`, message },
];

// Screen readers announce a control by its role and a field by its label. TabBarButton passes
// the navigator's `role` on, which React Native maps to the same thing. Only the presence of the
// attribute is checked, not its value.
const pressable = ":matches([name.name='Pressable'], [name.property.name='Pressable'])";
const textInput = ":matches([name.name='TextInput'], [name.property.name='TextInput'])";

// A sheet backdrop is hidden from screen readers on both platforms, its sheet having a Cancel
// button. accessible={false} alone does not hide a touchable view from TalkBack.
const hiddenFromScreenReaders = [
  "JSXAttribute[name.name='importantForAccessibility'][value.value=/^no(-hide-descendants)?$/]",
  "JSXAttribute[name.name='accessibilityElementsHidden']:not([value.expression.value=false])",
]
  .map((attribute) => `:has(> ${attribute})`)
  .join('');

function requiredAttribute(element, attributes, message, { exemptWhenHidden }) {
  const exempt = attributes.map((name) => `:has(> JSXAttribute[name.name='${name}'])`);
  if (exemptWhenHidden) exempt.push(hiddenFromScreenReaders);
  return { selector: `JSXOpeningElement${element}:not(${exempt.join(', ')})`, message };
}

const checkedComponents = '/^(Pressable|TextInput)$/';
const checkedMessage =
  'Use Pressable and TextInput under their own names, so the accessibility rules can check them.';

const accessibilitySyntax = [
  requiredAttribute(
    pressable,
    ['accessibilityRole', 'role'],
    'Give every Pressable an accessibilityRole, such as "button".',
    { exemptWhenHidden: true },
  ),
  requiredAttribute(
    textInput,
    ['accessibilityLabel', 'aria-label'],
    'Give every TextInput an accessibilityLabel: a placeholder is not read once text is typed.',
    { exemptWhenHidden: false },
  ),
  {
    selector: `CallExpression:matches([callee.name='createAnimatedComponent'], [callee.property.name='createAnimatedComponent'])[arguments.0.name=${checkedComponents}]`,
    message: checkedMessage,
  },
  { selector: `VariableDeclarator[init.name=${checkedComponents}]`, message: checkedMessage },
  {
    selector: `ImportSpecifier[imported.name=${checkedComponents}]:not([local.name=${checkedComponents}])`,
    message: checkedMessage,
  },
  {
    selector:
      "JSXOpeningElement[name.name='Text']:has(> JSXAttribute[name.name=/^on(Press|LongPress)$/])",
    message: 'Put pressable text in a Pressable with an accessibilityRole.',
  },
];

// Colors kept to a few files, each for one use. The locked color is too dark for text or a
// control's outline (decision 0032): only the locked emblems draw it. Red marks destructive
// actions and emergency numbers only, never a lapse, the counter or the ranks (decision 0034).
const ownedColors = [
  {
    name: 'locked',
    owners: ['src/ui/rank-emblem.tsx'],
    use: 'the outline of locked emblems',
    hint: 'Dimmed text and control outlines use colors.muted.',
  },
  {
    name: 'danger',
    owners: [
      'src/ui/button.tsx',
      'src/ui/nav-row.tsx',
      'src/features/settings/erase-view.tsx',
      'src/features/settings/settings-screen.tsx',
      'src/features/help/help-screen.tsx',
    ],
    use: 'destructive actions and emergency numbers',
  },
];
const colorOwners = [...new Set(ownedColors.flatMap((color) => color.owners))];

// One rule per color that `file` does not own, so every color for a file that owns none (null).
function ownedColorSyntax(file) {
  return ownedColors
    .filter((color) => !color.owners.includes(file))
    .map(({ name, owners, use, hint }) => ({
      selector: `MemberExpression[object.name='colors'][property.name='${name}']`,
      message: [`colors.${name} is only for ${use}, in ${owners.join(', ')}.`, hint]
        .filter(Boolean)
        .join(' '),
    }));
}

function restrictedSyntax(files, ignores, rules) {
  return { files, ignores, rules: { 'no-restricted-syntax': ['error', ...rules] } };
}

function layerImports(name) {
  return `^@/(${name.join('|')})(/|$)`;
}

// Only cross-layer imports through the `@/` alias can be checked without a resolver.
const parentImport = {
  regex: '^\\.\\./',
  message: 'Import from another folder through the @/ alias.',
};

// Scrolling goes through src/ui/scroll-view.tsx, which turns off the Android stretch effect.
const nativeScrollViews = {
  name: 'react-native',
  importNames: ['ScrollView', 'FlatList', 'SectionList', 'VirtualizedList'],
  message: `Use ScrollView from @/ui/scroll-view. Add a list there if one is needed, with overScrollMode="never".`,
};

// The Touchable components escape the Pressable accessibility rule.
const touchables = {
  name: 'react-native',
  importNames: [
    'TouchableOpacity',
    'TouchableHighlight',
    'TouchableWithoutFeedback',
    'TouchableNativeFeedback',
  ],
  message: 'Use Pressable with an accessibilityRole.',
};

// Native libraries that touch privacy are each used from one file, so what they may do is
// reviewed in one place. Other files may import their types.
const ownedPackages = [
  { name: 'expo-notifications', owner: 'src/features/reminders/notifier.ios.ts' },
  { name: 'expo-local-authentication', owner: 'src/features/lock/local-auth.ts' },
  { name: 'expo-screen-capture', owner: 'src/features/lock/privacy-screen.ios.ts' },
];

// Parts of a package that touch privacy, each used from one file, like the packages above.
const ownedImports = [
  {
    name: 'react-native',
    importNames: ['Share'],
    owner: 'src/features/errors/share-report.ts',
    message:
      'Share is only used from src/features/errors/share-report.ts: the error report is the only thing flust shares.',
  },
];

// Local notifications only: nothing that registers the device with a push service.
const pushFunctions = {
  name: 'expo-notifications',
  importNames: [
    'getExpoPushTokenAsync',
    'getDevicePushTokenAsync',
    'addPushTokenListener',
    'removePushTokenSubscription',
    'setAutoServerRegistrationEnabledAsync',
    'unregisterForNotificationsAsync',
    'registerTaskAsync',
    'unregisterTaskAsync',
  ],
  message:
    'flust sends no data off the device: push notifications are not used. See docs/decisions/0021-local-notifications.md.',
};

// Library APIs that reach the network without naming fetch, which the globals rule cannot see.
const networkMessage =
  'flust makes no network calls. See docs/decisions/0006-no-network-access.md.';

const networkImportPaths = [
  { name: 'expo/fetch', message: networkMessage },
  {
    name: 'react-native-svg',
    importNames: ['SvgUri', 'SvgCssUri', 'SvgFromUri', 'SvgWithCssUri', 'fetchText'],
    message: networkMessage,
  },
];

// The global router is bound to the last navigation container that mounted and is unbound when any
// container unmounts, so it fails after Android recreates the activity. useRouter() goes through
// the screen's own container (docs/decisions/0048-router-per-root.md).
const globalRouter = {
  name: 'expo-router',
  importNames: ['router'],
  message: 'Use useRouter(): the global router breaks after the activity is recreated.',
};

// The methods of useRouter() that still read the navigation reference shared by every container,
// which the old one clears as it unmounts. A namespace import of expo-router is already refused
// with the global router above.
const routerSyntax = ["object.name='router'", "object.callee.name='useRouter'"].map((object) => ({
  selector: `MemberExpression[${object}][property.name=/^(canGoBack|canDismiss|setParams)$/]`,
  message:
    'Use useCanGoBack(), and no canDismiss or setParams: they read a navigation reference that breaks after the activity is recreated. See docs/decisions/0048-router-per-root.md.',
}));

const networkImportPatterns = [{ regex: '^expo-file-system/legacy$', message: networkMessage }];

const networkProperties = ['downloadFileAsync', 'upload'].map((property) => ({
  property,
  message: networkMessage,
}));

function ownedPackagePatterns(owner) {
  return ownedPackages
    .filter((owned) => owned.owner !== owner)
    .map((owned) => ({
      regex: `^${owned.name}(/|$)`,
      allowTypeImports: true,
      message: `${owned.name} is only used from ${owned.owner}.`,
    }));
}

function ownedImportPaths(owner) {
  return ownedImports
    .filter((owned) => owned.owner !== owner)
    .map(({ name, importNames, message }) => ({ name, importNames, message }));
}

const owners = [...ownedPackages, ...ownedImports].map((owned) => owned.owner);

function layer(
  name,
  { forbidden, typesOnly = [], packages = false, allowNativeScroll = false, owner = null },
) {
  const patterns = [parentImport, ...networkImportPatterns, ...ownedPackagePatterns(owner)];
  if (forbidden.length > 0) {
    patterns.push({
      regex: layerImports(forbidden),
      message: `src/${name} may not import from ${forbidden.map((l) => `src/${l}`).join(', ')}. See docs/development/conventions.md.`,
    });
  }
  if (typesOnly.length > 0) {
    patterns.push({
      regex: layerImports(typesOnly),
      allowTypeImports: true,
      message: `src/${name} may only import types from ${typesOnly.map((l) => `src/${l}`).join(', ')}.`,
    });
  }
  if (packages) {
    patterns.push({
      regex: reactAndExpoPackages,
      message: `src/${name} is pure logic and may not depend on React, React Native or Expo.`,
    });
  }
  const paths = [
    ...networkImportPaths,
    touchables,
    globalRouter,
    ...(allowNativeScroll ? [] : [nativeScrollViews]),
    ...ownedImportPaths(owner),
  ];
  if (owner === 'src/features/reminders/notifier.ios.ts') paths.push(pushFunctions);
  return {
    files: [`src/${name}/**/*.{ts,tsx}`],
    rules: { '@typescript-eslint/no-restricted-imports': ['error', { paths, patterns }] },
  };
}

function except(...allowed) {
  return layers.filter((l) => !allowed.includes(l));
}

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'android/*', 'ios/*', 'coverage/*'],
  },
  {
    files: ['*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },
  // Rules that need type information, kept to those that catch real bugs: a rejected promise
  // nobody handles, a promise passed where a void callback is expected, a switch that misses a
  // case of a union, and a try that returns a promise its catch never sees.
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: __dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: false, requireDefaultForNonUnion: false },
      ],
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/prefer-promise-reject-errors': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/restrict-template-expressions': 'error',
      '@typescript-eslint/no-meaningless-void-operator': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
    },
  },
  {
    files: sourceFiles,
    rules: {
      // test/no-network-apis.test.ts also catches them through globalThis and in native code.
      'no-restricted-globals': [
        'error',
        ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
          name,
          message: networkMessage,
        })),
      ],
      'no-restricted-properties': ['error', ...networkProperties],
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
    },
  },
  layer('domain', { forbidden: except('domain'), packages: true }),
  layer('data', { forbidden: except('data', 'domain', 'lib') }),
  layer('features', { forbidden: except('features', 'domain', 'data', 'ui', 'lib') }),
  ...owners.map((owner) => ({
    ...layer('features', { forbidden: except('features', 'domain', 'data', 'ui', 'lib'), owner }),
    files: [owner],
  })),
  layer('ui', { forbidden: except('ui', 'domain'), typesOnly: ['domain'] }),
  {
    ...layer('ui', {
      forbidden: except('ui', 'domain'),
      typesOnly: ['domain'],
      allowNativeScroll: true,
    }),
    files: [scrollViewFile],
  },
  layer('app', { forbidden: except('app', 'features', 'ui', 'lib') }),
  layer('lib', { forbidden: except('lib') }),
  restrictedSyntax(
    sourceFiles,
    [themeFile, ...testFiles, ...colorOwners],
    [
      ...hexColorSyntax,
      ...literalTextSyntax,
      ...accessibilitySyntax,
      ...ownedColorSyntax(null),
      ...routerSyntax,
    ],
  ),
  ...colorOwners.map((file) =>
    restrictedSyntax(
      [file],
      [],
      [
        ...hexColorSyntax,
        ...literalTextSyntax,
        ...accessibilitySyntax,
        ...ownedColorSyntax(file),
        ...routerSyntax,
      ],
    ),
  ),
  restrictedSyntax([themeFile], [], [...literalTextSyntax, ...routerSyntax]),
  restrictedSyntax(testFiles, [], [...hexColorSyntax, ...routerSyntax]),
  prettierConfig,
]);
