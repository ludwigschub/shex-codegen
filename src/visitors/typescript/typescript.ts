import { normalizeUrl } from "../common";
import {
  generateValueExpression,
  generateCommentFromAnnotations,
  generateEnumValues,
  generateTsType,
  generateEnumName,
  generateTripleConstraint,
} from "./generates";

const ShExUtil = require("@shexjs/core").Util;

const _visitor = ShExUtil.Visitor();

_visitor._visitValue = function (v: any[]) {
  return Array.isArray(v) ? (v.length > 1 ? v.join("\n") : v.join("")) : v;
};

_visitor.visitSchema = function (schema: any) {
  ShExUtil._expect(schema, "type", "Schema");
  const shapeDeclarations = this.visitShapes(
    schema["shapes"],
    schema._prefixes
  );
  return shapeDeclarations.join("\n");
};

_visitor.visitExpression = function (expr: any, context?: any) {
  if (typeof expr === "string") return this.visitInclusion(expr);
  const visited =
    expr.type === "TripleConstraint"
      ? this.visitTripleConstraint(expr, context)
      : expr.type === "OneOf"
      ? this.visitOneOf(expr, context)
      : expr.type === "EachOf"
      ? this.visitEachOf(expr, context)
      : null;
  if (visited === null) throw Error("unexpected expression type: " + expr.type);
  else return visited;
};

_visitor.visitOneOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) => {
      if (expression.type === "TripleConstraint") {
        const visitedExpression = this.visitTripleConstraint(
          expression,
          context
        );
        visitedExpression.generated = visitedExpression.generated
          ? `{ ${visitedExpression.generated} }`
          : "";
        visitedExpression.extra = visitedExpression.extra
          ? `{ ${visitedExpression.extra} }`
          : "";
        return visitedExpression;
      }

      if (expression.type === "EachOf") {
        return this.visitEachOf(expression, context);
      } else if (expression.type === "OneOf") {
        return this.visitOneOf(expression, context);
      }
    }),
  };

  visited.generated = `${visited.expressions
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join(" | ")}`;

  visited.extras = visited.expressions
    .reduce(
      (extras: any[], expression: any) =>
        expression.extra
          ? [...extras, expression.extra]
          : expression.extras
          ? [...extras, expression.extras]
          : extras,
      []
    )
    .join(" & ");

  const inlineEnums = visited.expressions
    .filter((expression: any) => {
      return !!expression?.inlineEnums;
    })
    .reduce(
      (inlineEnums: any, expression: any) =>
        expression.inlineEnums
          ? [...inlineEnums, ...expression.inlineEnums]
          : inlineEnums,
      []
    );

  if (Object.keys(inlineEnums).length > 0) {
    visited.inlineEnums = inlineEnums;
  }

  return visited;
};

_visitor.visitEachOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) => {
      if (expression.type === "TripleConstraint") {
        const visitedExpression = this.visitTripleConstraint(
          expression,
          context
        );
        visitedExpression.extra = visitedExpression.extra
          ? `{ 
  ${visitedExpression.extra} 
}`
          : "";

        return visitedExpression;
      }

      if (expression.type === "EachOf") {
        return this.visitEachOf(expression, context);
      } else if (expression.type === "OneOf") {
        const result = this.visitOneOf(expression, context);
        result.extras = result.generated;
        result.generated = "";
        return result;
      }
    }),
  };

  visited.generated = `{
  ${visited.expressions
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join("\n  ")}
}`;

  visited.extras = visited.expressions
    .reduce(
      (extras: any[], expression: any) =>
        expression.extra
          ? [...extras, expression.extra]
          : expression.extras
          ? [...extras, expression.extras]
          : extras,
      []
    )
    .join(" & ");

  const inlineEnums = visited.expressions
    .filter((expression: any) => {
      return !!expression.inlineEnums;
    })
    .reduce(
      (inlineEnums: any, expression: any) =>
        expression.inlineEnums
          ? [...inlineEnums, ...expression.inlineEnums]
          : inlineEnums,
      []
    );

  if (Object.keys(inlineEnums).length > 0) {
    visited.inlineEnums = inlineEnums;
  }

  return visited;
};

_visitor.visitTripleConstraint = function (expr: any, context?: any) {
  const members = [
    "id",
    "inverse",
    "predicate",
    "valueExpr",
    "min",
    "max",
    "onShapeExpression",
    "annotations",
    "semActs",
  ];
  const visited = {
    ...expr,
    expression: maybeGenerate(this, expr, members, {
      ...context,
      predicate: expr.predicate,
    }),
  };
  const { valueExpr } = visited.expression;

  if (valueExpr.inlineEnum) {
    visited.inlineEnums = [valueExpr.inlineEnum];
  } else if (valueExpr?.inlineEnums) {
    visited.inlineEnums = valueExpr.inlineEnums;
  }

  visited.typeValue = generateValueExpression(valueExpr, context);
  const comment = generateCommentFromAnnotations(visited.annotations);
  visited.generated = generateTripleConstraint(
    valueExpr,
    visited.typeValue,
    visited.predicate,
    comment,
    visited.min > 0,
    visited.max === -1
  );

  if (context?.extra?.includes(visited.predicate) && !valueExpr.values) {
    visited.extra = visited.generated;
    visited.generated = "";
  }

  return visited;
};

_visitor.visitNodeConstraint = function (shape: any, context: any) {
  ShExUtil._expect(shape, "type", "NodeConstraint");

  const members = [
    "id",
    "nodeKind",
    "datatype",
    "pattern",
    "flags",
    "length",
    "reference",
    "minlength",
    "maxlength",
    "mininclusive",
    "minexclusive",
    "maxinclusive",
    "maxexclusive",
    "totaldigits",
    "fractiondigits",
    "values",
    "annotations",
    "semActs",
  ];

  const visited: Record<string, any> = {
    expression: maybeGenerate(this, shape, members, context),
  };

  if (visited.expression.values) {
    visited.typeValue = generateEnumName(
      context.id as string,
      context.predicate
    );
    visited.inlineEnum = {
      [visited.typeValue]: [
        ...visited.expression.values,
        ...(context.inlineEnums ? context.inlineEnums[visited.typeValue] : []),
      ],
    };
  } else {
    visited.typeValue = generateTsType(visited);
  }

  return visited;
};

_visitor.visitShape = function (shape: any, context: any) {
  ShExUtil._expect(shape, "type", "Shape");

  shape.expression.expressions = shape.expression.expressions?.reduce(
    (currentExpressions: any[], currentExpression: any) => {
      const duplicate = currentExpressions?.find(
        (expression) => expression.predicate === currentExpression.predicate
      );
      return duplicate && duplicate.valueExpr && currentExpression.valueExpr
        ? [
            ...currentExpressions.filter(
              (expression) => expression.predicate !== duplicate.predicate
            ),
            {
              ...currentExpression,
              valueExpr:
                duplicate.valueExpr?.values &&
                currentExpression.valueExpr?.values
                  ? {
                      ...duplicate.valueExpr,
                      values: [
                        ...duplicate.valueExpr.values,
                        ...currentExpression.valueExpr.values,
                      ],
                    }
                  : currentExpression.valueExpr,
            },
          ]
        : [...currentExpressions, currentExpression];
    },
    []
  );

  const visited = maybeGenerate(
    this,
    shape,
    [
      "id",
      "abstract",
      "extends",
      "closed",
      "expression",
      "semActs",
      "annotations",
    ],
    context
  );

  visited.extras =
    visited.expression.extras ??
    (visited.expression.extra && `{ ${visited.expression.extra} }`);
  const { generated } = visited.expression;
  visited.generatedShape = visited.extras
    ? generated
      ? `${generated} & (${visited.extras})`
      : `${visited.extras}`
    : generated;

  visited.inlineEnums = visited.expression.inlineEnums;

  if (visited.expression?.type === "TripleConstraint") {
    visited.generatedShape = `{\n${visited.expression.generated}\n}`;
  }

  return visited;
};

_visitor.visitShapes = function (shapes: any[], prefixes: any) {
  if (shapes === undefined) return undefined;
  const inlineEnums: Record<string, any[]> = {};

  const visited = shapes.map((shape: any) => {
    if (shape.values) {
      return `export enum ${generateEnumName(shape.id)} ${generateEnumValues(
        shape.values,
        prefixes
      )};\n`;
    }

    const visitedShape = this.visitShapeDecl({ ...shape, prefixes: prefixes });

    if (visitedShape.inlineEnums) {
      visitedShape.inlineEnums.forEach((inlineEnum: any) => {
        Object.keys(inlineEnum).forEach((enumKey: string) => {
          if (!inlineEnums[enumKey]) {
            inlineEnums[enumKey] = inlineEnum[enumKey];
          } else {
            inlineEnums[enumKey] = Object.values(
              Object.assign(
                {},
                ...inlineEnum[enumKey].map((value: string) => ({
                  [value]: value,
                })),
                ...inlineEnums[enumKey].map((value) => ({
                  [value]: value,
                }))
              )
            );
          }
        });
      });
    }

    return { id: shape.id, ...visitedShape };
  });

  const generatedShapes = visited.map((shape: any | string) => {
    if (typeof shape === "string") {
      return shape;
    } else {
      // if (
      //   shape?.id ===
      //   "https://shaperepo.com/schemas/solidProfile##cryptocurrency"
      // )
      //   console.debug(shape);
      return `export type ${normalizeUrl(shape.id, true)} = ${
        shape.generatedShape
      };\n`;
    }
  });

  const generatedInlineEnums = Object.keys(inlineEnums).map((key) => {
    return `export enum ${key} ${generateEnumValues(
      inlineEnums[key],
      prefixes
    )};\n`;
  });

  return [...generatedInlineEnums, ...generatedShapes];
};

function maybeGenerate(
  Visitor: any,
  obj: any,
  members: string[],
  context?: any
) {
  const generated: Record<string, any> = {};
  members.forEach(function (member) {
    var methodName = "visit" + member.charAt(0).toUpperCase() + member.slice(1);
    if (member in obj) {
      var f = Visitor[methodName];
      if (typeof f !== "function") {
        throw Error(methodName + " not found in Visitor");
      }
      var t = f.call(
        Visitor,
        obj[member],
        context ?? {
          id: obj?.id,
          prefixes: obj?.prefixes,
          extra: obj?.extra,
        }
      );
      if (t !== undefined) {
        generated[member] = t;
      }
    }
  });
  return generated;
}

export const TypescriptVisitor = _visitor;

export default _visitor;
