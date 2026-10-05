import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// Next.js 16 ships its lint rules as flat config, so no compatibility layer is needed.
const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    // Loosen a few of the framework's default rules from an error to a warning, so a small mistake
    // never blocks a beginner's build. Prefixing an unused variable, argument or caught
    // error with an underscore (for example `_event`) tells the linter it is unused on purpose and
    // silences the warning.
    rules: {
      '@typescript-eslint/ban-ts-comment': 'warn',
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          args: 'after-used',
          ignoreRestSiblings: false,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^(_|ignore)',
        },
      ],
    },
  },
  {
    // Generated files (never hand-edited) and docs/ (the specification and plan for this starter,
    // not app code): never linted.
    ignores: ['.next/', '.superpowers/', 'src/payload-types.ts', 'src/app/(payload)/admin/importMap.js', 'src/migrations/', 'docs/'],
  },
]

export default eslintConfig
