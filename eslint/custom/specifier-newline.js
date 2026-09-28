/**
 * Force each specifier in an import, export, or destructuring pattern onto its
 * own line when there are 2 or more. `@stylistic/object-property-newline` only
 * visits `ObjectExpression`, so destructuring patterns and import/export
 * specifiers go uncovered.
 */
export const specifierNewline = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    schema: [],
    messages: {
      newlineRequired: '{{kind}} specifiers must each be on their own line when there are 2 or more.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    function check(
      specifiers,
      kind,
    ) {
      if (specifiers.length < 2) {
        return;
      }
      for (let i = 1; i < specifiers.length; i++) {
        const previous = specifiers[i - 1];
        const current = specifiers[i];
        if (previous.loc.end.line !== current.loc.start.line) {
          continue;
        }
        context.report({
          node: current,
          messageId: 'newlineRequired',
          data: { kind },
          fix(fixer) {
            const comma = sourceCode.getTokenAfter(
              previous,
              (token) => token.value === ',',
            );
            if (!comma) {
              return null;
            }
            return fixer.replaceTextRange(
              [
                comma.range[1],
                current.range[0],
              ],
              '\n',
            );
          },
        });
      }
    }
    function checkParams(node) {
      check(
        node.params,
        'Parameter',
      );
    }
    return {
      ImportDeclaration(node) {
        check(
          node.specifiers.filter((s) => s.type === 'ImportSpecifier'),
          'Import',
        );
      },
      ExportNamedDeclaration(node) {
        check(
          node.specifiers,
          'Export',
        );
      },
      ObjectPattern(node) {
        check(
          node.properties,
          'Destructuring',
        );
      },
      FunctionDeclaration: checkParams,
      FunctionExpression: checkParams,
      ArrowFunctionExpression: checkParams,
    };
  },
};
