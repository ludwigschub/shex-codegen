import { normalizeUrl } from "../common";
import {
  generateShapeExport,
  generateEnumName,
  generateEnumExport,
  generateExpressions,
  generateTripleConstraint,
  generateValueExpression,
  generateTsType,
  generateCommentFromAnnotations,
  generateExtras,
} from "./generates";
import { addUniqueInlineEnums, reduceInlineEnums } from "./inlineEnumHelpers";
import { mapEachOfExpression, mapOneOfExpressions } from "./mapExpressions";
import {
  NodeConstraintMembers,
  ShapeMembers,
  TripleConstraintMembers,
} from "./members";

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
    expressions: expr.expressions.map((expression: any) =>
      mapOneOfExpressions(this, expression, context)
    ),
  };

  visited.generated = generateExpressions(visited.expressions, " | ");
  visited.extras = generateExtras(visited.expressions);
  visited.inlineEnums = reduceInlineEnums(visited.expressions);

  return visited;
};

_visitor.visitEachOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) =>
      mapEachOfExpression(this, expression, context)
    ),
  };

  visited.generated = generateExpressions(visited.expressions);
  visited.extras = generateExtras(visited.expressions);
  visited.inlineEnums = reduceInlineEnums(visited.expressions);

  return visited;
};

_visitor.visitTripleConstraint = function (expr: any, context?: any) {
  const visited = {
    ...expr,
    expression: maybeGenerate(this, expr, TripleConstraintMembers, {
      ...context,
      predicate: expr.predicate,
    }),
  };
  const { valueExpr } = visited.expression;
  const { inlineEnum, inlineEnums } = valueExpr;

  visited.inlineEnums = inlineEnum ? [inlineEnum] : inlineEnums;
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

  const visited: Record<string, any> = {
    expression: maybeGenerate(this, shape, NodeConstraintMembers, context),
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

  const visited = maybeGenerate(this, shape, ShapeMembers, context);
  const { generated, extras, extra, inlineEnums, type } = visited.expression;

  // generate shape from visited expression
  let generatedShape = "";
  const generatedExtras = extras ?? (extra && `{ ${extra} }`);
  if (generatedExtras) {
    if (generated) {
      generatedShape = `${generated} & (${generatedExtras})`;
    } else {
      generatedShape = generatedExtras;
    }
  }
  if (type === "TripleConstraint") {
    generatedShape = `{\n${generated}\n}`;
  }

  // use inline enums from visited expression
  visited.inlineEnums = inlineEnums;

  return { ...visited, generatedShape };
};

_visitor.visitShapes = function (shapes: any[], prefixes: any) {
  if (shapes === undefined) return undefined;
  let inlineEnums: Record<string, any[]> = {};

  const visited = shapes.map((shape: any) => {
    if (shape.values) {
      return generateEnumExport(shape.id, shape.values, prefixes);
    }

    const visitedShape = this.visitShapeDecl({ ...shape, prefixes: prefixes });

    if (visitedShape.inlineEnums) {
      inlineEnums = addUniqueInlineEnums(inlineEnums, visitedShape.inlineEnums);
    }

    return { id: shape.id, ...visitedShape };
  });

  const generatedShapes = visited.map((shape: any | string) => {
    if (typeof shape === "string") {
      return shape;
    } else {
      return generateShapeExport(
        normalizeUrl(shape.id, true),
        shape.generatedShape
      );
    }
  });

  const generatedInlineEnums = Object.keys(inlineEnums).map((key) =>
    generateEnumExport(key, inlineEnums[key], prefixes)
  );

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
