import { normalizeUrl } from "../common";
import { putInBraces } from "./generates";

export function mapOneOfExpressions(
  visitor: any,
  expression: any,
  context: any
) {
  if (typeof expression === "string") {
    return { type: "Inclusion", include: normalizeUrl(expression, true) };
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
    visitedExpression.generatedToCreate = visitedExpression.generatedToCreate
      ? putInBraces(visitedExpression.generatedToCreate)
      : "";
    visitedExpression.extraToCreate = visitedExpression.extraToCreate
      ? putInBraces(visitedExpression.extraToCreate)
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
    return { type: "Inclusion", include: normalizeUrl(expression, true) };
  }
  if (expression.type === "TripleConstraint") {
    const visitedExpression = visitor.visitTripleConstraint(
      expression,
      context
    );
    visitedExpression.extra = visitedExpression.extra
      ? putInBraces(visitedExpression.extra)
      : "";
    visitedExpression.extraToCreate = visitedExpression.extraToCreate
      ? putInBraces(visitedExpression.extraToCreate)
      : "";

    return visitedExpression;
  }

  if (expression.type === "EachOf") {
    const visited = visitor.visitEachOf(expression, context);
    return visited;
  } else if (expression.type === "OneOf") {
    const visited = visitor.visitOneOf(expression, context);
    if (visited.generated) {
      visited.extras = `(${visited.generated})`;
      visited.generated = "";
    }
    if (visited.generatedToCreate) {
      visited.extrasToCreate = `(${visited.generatedToCreate})`;
      visited.generatedToCreate = "";
    }
    return visited;
  }
}
