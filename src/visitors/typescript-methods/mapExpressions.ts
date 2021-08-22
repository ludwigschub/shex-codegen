import { normalizeUrl } from "../common";

export function mapExpression(
  visitor: any,
  expression: any,
  context: any,
  duplicatePredicate?: string,
) {
  if (typeof expression === "string") {
    return { type: "Inclusion", include: [normalizeUrl(expression, true)] };
  }

  if (expression.type === "TripleConstraint") {
    const visitedExpression = visitor.visitTripleConstraint(
      expression,
      context,
      duplicatePredicate
    );
    return visitedExpression;
  }

  if (expression.type === "EachOf") {
    return visitor.visitEachOf(expression, context);
  } else if (expression.type === "OneOf") {
    return visitor.visitOneOf(expression, context);
  }
}
