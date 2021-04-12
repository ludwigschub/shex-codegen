import { normalizeUrl } from "../common";
import { putInBraces } from "./generates";

export function mapOneOfExpressions(
  visitor: any,
  expression: any,
  context: any
) {
  if (typeof expression === "string") {
    return { extra: normalizeUrl(expression, true) };
  }
  if (expression.type === "TripleConstraint") {
    const visitedExpression = visitor.visitTripleConstraint(
      expression,
      context
    );
    visitedExpression.generated = visitedExpression.generated
      ? putInBraces(visitedExpression.generated)
      : "";
    visitedExpression.extra = visitedExpression.extra
      ? putInBraces(visitedExpression.extra)
      : "";
    return visitedExpression;
  }

  if (expression.type === "EachOf") {
    return visitor.visitEachOf(expression, context);
  } else if (expression.type === "OneOf") {
    return visitor.visitOneOf(expression, context);
  }
}

export function mapEachOfExpression(
  visitor: any,
  expression: any,
  context: any
) {
  if (typeof expression === "string") {
    return { extra: normalizeUrl(expression, true) };
  }
  if (expression.type === "TripleConstraint") {
    const visitedExpression = visitor.visitTripleConstraint(
      expression,
      context
    );
    visitedExpression.extra = visitedExpression.extra
      ? putInBraces(visitedExpression.extra)
      : "";

    return visitedExpression;
  }

  if (expression.type === "EachOf") {
    const visited = visitor.visitEachOf(expression, context);
    return visited;
  } else if (expression.type === "OneOf") {
    const visited = visitor.visitOneOf(expression, context);
    visited.extras = visited.generated;
    visited.generated = "";
    return visited;
  }
}
