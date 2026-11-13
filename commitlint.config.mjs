const forbiddenPatterns = [/co-authored-by/i, /claude/i, /anthropic/i, /generated with/i];
const emoji = /\p{Extended_Pictographic}/u;

const noForbiddenContent = ({ raw }) => {
  const message = raw ?? '';
  const match = forbiddenPatterns.find((pattern) => pattern.test(message));
  if (match) {
    return [false, `message must not contain "${message.match(match)[0]}"`];
  }
  if (emoji.test(message)) {
    return [false, 'message must not contain emojis'];
  }
  return [true];
};

// Dependabot bodies embed upstream release notes, with long lines and emojis we do not control.
const isDependabotCommit = (message) => message.includes('Signed-off-by: dependabot[bot]');

export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [isDependabotCommit],
  plugins: [{ rules: { 'no-forbidden-content': noForbiddenContent } }],
  rules: {
    'no-forbidden-content': [2, 'always'],
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'ci', 'build', 'perf', 'security'],
    ],
    'header-max-length': [2, 'always', 100],
  },
};
