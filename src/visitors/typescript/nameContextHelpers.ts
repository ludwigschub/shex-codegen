import { normalizeUrl } from "../common";

export const predicateToNameContext = (
  expression: any,
  prefixes: Record<string, string>
) => {
  if (expression.predicate) {
    const normalizedValue = normalizeUrl(expression.predicate);
    const prefix =
      Object.keys(prefixes).find((prefix) =>
        expression.predicate.includes(prefixes[prefix])
      ) ??
      (normalizedValue === "type" && "rdf");
    if (!prefix) {
      throw Error("Unknown prefix found in schema: " + prefix);
    }
    return { name: normalizedValue, value: `${prefix}:${normalizedValue}` };
  } else {
    return;
  }
};

export const reduceNameContexts = (expressions: any[]) => {
  return expressions.reduce(
    (entireShapeContext: Record<string, string>, expression: any) => {
      if (expression.nameContext) {
        const { name, value } = expression.nameContext;
        return { ...entireShapeContext, [name]: value };
      } else {
        return entireShapeContext;
      }
    },
    {}
  );
};
