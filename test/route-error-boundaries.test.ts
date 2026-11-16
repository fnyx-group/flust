import fs from 'node:fs';
import path from 'node:path';

const appDirectory = path.join(__dirname, '..', 'src', 'app');

// Nested layouts are covered by the boundaries of their screens and of the root; the native
// intent file renders nothing.
function routeFiles(): string[] {
  return fs
    .readdirSync(appDirectory, { recursive: true, encoding: 'utf8' })
    .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
    .filter(
      (file) => file === '_layout.tsx' || !/(^|\/)(_layout|\+native-intent)\.tsx$/.test(file),
    );
}

describe('routes', () => {
  it.each(routeFiles())('%s exports an error boundary', (file) => {
    const source = fs.readFileSync(path.join(appDirectory, file), 'utf8');

    expect(source).toMatch(/export \{ \w+ as ErrorBoundary \} from '@\/features\/errors\//);
  });

  it('give the onboarding a boundary without a way home, since there is none yet', () => {
    const source = fs.readFileSync(path.join(appDirectory, 'onboarding.tsx'), 'utf8');

    expect(source).toContain('RetryOnlyErrorBoundary as ErrorBoundary');
  });
});
