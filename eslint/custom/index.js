import { noParentRelativeImports } from './no-parent-relative-imports.js';
import { specifierNewline } from './specifier-newline.js';

export const customPlugin = {
  meta: { name: 'custom' },
  rules: {
    'specifier-newline': specifierNewline,
    'no-parent-relative-imports': noParentRelativeImports,
  },
};
