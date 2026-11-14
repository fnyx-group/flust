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

function layer(name, { forbidden, typesOnly = [], packages = false, allowNativeScroll = false }) {
  const patterns = [parentImport];
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
  const paths = allowNativeScroll ? [] : [nativeScrollViews];
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
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/incompatible-library': 'error',
      'react-hooks/unsupported-syntax': 'error',
    },
  },
  layer('domain', { forbidden: except('domain'), packages: true }),
  layer('data', { forbidden: except('data', 'domain', 'lib') }),
  layer('features', { forbidden: except('features', 'domain', 'data', 'ui', 'lib') }),
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
    [...hexColorSyntax, ...literalTextSyntax],
  ),
  restrictedSyntax([themeFile], [], literalTextSyntax),
  restrictedSyntax(testFiles, [], hexColorSyntax),
  prettierConfig,
]);
