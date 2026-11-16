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
// the navigator's `role` on, which React Native maps to the same thing. A sheet backdrop is
// hidden from screen readers with accessible={false}, its sheet having a Cancel button.
const hiddenFromScreenReaders =
  "JSXAttribute[name.name='accessible'][value.expression.value=false]";

function requiredAttribute(element, attributes, message) {
  const exempt = [
    ...attributes.map((name) => `JSXAttribute[name.name='${name}']`),
    hiddenFromScreenReaders,
  ];
  const present = exempt.map((attribute) => `:has(> ${attribute})`).join(', ');
  return { selector: `JSXOpeningElement[name.name='${element}']:not(${present})`, message };
}

const accessibilitySyntax = [
  requiredAttribute(
    'Pressable',
    ['accessibilityRole', 'role'],
    'Give every Pressable an accessibilityRole, such as "button".',
  ),
  requiredAttribute(
    'TextInput',
    ['accessibilityLabel', 'aria-label'],
    'Give every TextInput an accessibilityLabel: a placeholder is not read once text is typed.',
  ),
];

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
    [themeFile, ...testFiles],
    [...hexColorSyntax, ...literalTextSyntax, ...accessibilitySyntax],
  ),
  restrictedSyntax([themeFile], [], literalTextSyntax),
  restrictedSyntax(testFiles, [], hexColorSyntax),
  prettierConfig,
]);
