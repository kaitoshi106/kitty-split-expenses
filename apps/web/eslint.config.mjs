import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      // Same layering convention as component-selector below.
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: ['app', 'ui'],
          style: 'camelCase',
        },
      ],
      // Prefixes mark the architectural layer:
      //   ui-*  → presentational components in ui/, no domain types
      //   app-* → feature components in features/
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: ['app', 'ui'],
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
