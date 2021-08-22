import { normalizeUrl } from '../common';

export const predicateToNameContext = (
  expression: any,
  prefixes: Record<string, string>,
  not?: string,
) => {
  if (expression.predicate) {
    const normalizedValue = not
      ? normalizeUrl(
          expression.predicate,
          false,
          normalizeUrl(not, false),
          prefixes,
        )
      : normalizeUrl(expression.predicate, false);
    const prefix =
      Object.keys(prefixes).find((prefix) =>
        expression.predicate.includes(prefixes[prefix]),
      ) ??
      (normalizedValue === 'type' && 'rdf');
    if (!prefix) {
      throw Error('Unknown prefix found in schema: ' + prefix);
    }
    return {
      name: normalizedValue,
      value: `${prefix}:${
        not ? normalizeUrl(expression.predicate, false) : normalizedValue
      }`,
    };
  } else {
    console.debug('Found expression without Predicate: ' + expression);
    return;
  }
};

export const reduceNameContexts = (expressions: any[]) => {
  return expressions.reduce(
    (entireShapeContext: Record<string, string>, expression: any) => {
      if (expression.nameContext) {
        const { name, value } = expression.nameContext;
        if (name && value) {
          return { ...entireShapeContext, [name]: value };
        } else {
          return { ...entireShapeContext, ...expression.nameContext };
        }
      } else {
        return entireShapeContext;
      }
    },
    {},
  );
};
