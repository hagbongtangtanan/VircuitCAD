import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/out/**',
      '**/release/**',
      '**/coverage/**',
      '.vc/**',
      'resources/**',
      'pnpm-lock.yaml',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['packages/sim-*/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'node:*',
                'fs',
                'fs/*',
                'path',
                'path/*',
                'os',
                'child_process',
                'crypto',
                'worker_threads',
                'stream',
                'util',
                'net',
                'tls',
                'http',
                'https',
              ],
              message: 'sim-* packages must stay pure TS: no Node built-ins.',
            },
            {
              group: ['electron', 'electron/*'],
              message: 'sim-* packages must stay pure TS: no Electron.',
            },
            {
              group: [
                '@vircuitcad/editor',
                '@vircuitcad/editor/*',
                '@vircuitcad/ui',
                '@vircuitcad/ui/*',
                '@vircuitcad/desktop',
                '@vircuitcad/desktop/*',
                '@vircuitcad/dev-server',
                '@vircuitcad/dev-server/*',
              ],
              message: 'sim-* packages must not import editor/ui/apps.',
            },
            {
              group: ['**/editor/**', '**/ui/**', '**/apps/**'],
              message: 'sim-* packages must not import editor/ui/apps via relative paths.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'sim-* packages must stay pure TS: no DOM.' },
        { name: 'window', message: 'sim-* packages must stay pure TS: no DOM.' },
        { name: 'navigator', message: 'sim-* packages must stay pure TS: no DOM.' },
        { name: 'localStorage', message: 'sim-* packages must stay pure TS: no DOM.' },
        { name: 'HTMLElement', message: 'sim-* packages must stay pure TS: no DOM.' },
      ],
    },
  },
);
