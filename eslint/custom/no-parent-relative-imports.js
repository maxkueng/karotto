import path from 'node:path';

/**
 * Forbid `../`-relative imports and auto-fix them to `@/` absolute imports.
 * Convention: each workspace package has `@/*` → `./src/*` in its tsconfig.
 * The rule walks up from the importing file to find its `src/` ancestor,
 * then rewrites the resolved path relative to that src root.
 *
 * Imports that resolve outside the importing package's `src/` are reported
 * without a fix — those are cross-package imports and should use the npm
 * package name instead.
 */
export const noParentRelativeImports = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    schema: [],
    messages: {
      useAbsolute: 'Use \'@/\' absolute imports for cross-module paths; got \'{{source}}\'.',
      crossPackage: 'Import \'{{source}}\' resolves outside this package\'s src/; use the npm package name instead.',
    },
  },
  create(context) {
    const filename = context.filename;
    const srcMarker = `${path.sep}src${path.sep}`;
    const srcIndex = filename.lastIndexOf(srcMarker);
    const srcRoot = srcIndex === -1 ? null : filename.slice(0, srcIndex + srcMarker.length);

    function check(sourceNode) {
      if (sourceNode === null || sourceNode.type !== 'Literal') {
        return;
      }
      const sourceValue = sourceNode.value;
      if (typeof sourceValue !== 'string' || !sourceValue.startsWith('../')) {
        return;
      }
      if (srcRoot === null) {
        return;
      }
      const fileDir = path.dirname(filename);
      const resolved = path.resolve(fileDir, sourceValue);
      if (!resolved.startsWith(srcRoot)) {
        context.report({
          node: sourceNode,
          messageId: 'crossPackage',
          data: { source: sourceValue },
        });
        return;
      }
      const insideSrc = resolved.slice(srcRoot.length).split(path.sep).join('/');
      const replacement = `@/${insideSrc}`;
      context.report({
        node: sourceNode,
        messageId: 'useAbsolute',
        data: { source: sourceValue },
        fix(fixer) {
          const quote = sourceNode.raw[0];
          return fixer.replaceText(sourceNode, `${quote}${replacement}${quote}`);
        },
      });
    }

    return {
      ImportDeclaration(node) {
        check(node.source);
      },
      ExportNamedDeclaration(node) {
        check(node.source);
      },
      ExportAllDeclaration(node) {
        check(node.source);
      },
    };
  },
};
