import { normalizeDuplicateProperties, normalizeUrl } from "../common";
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
  putInBraces,
  generateShape,
  generateNameContextsExport,
  generateRdfImport,
} from "./generates";
import { addUniqueInlineEnums, reduceInlineEnums } from "./inlineEnumHelpers";
import { mapEachOfExpression, mapOneOfExpressions } from "./mapExpressions";
import {
  NodeConstraintMembers,
  ShapeMembers,
  TripleConstraintMembers,
} from "../common/members";
import {
  predicateToNameContext,
  reduceNameContexts,
} from "./nameContextHelpers";
import { BasicShapeInterface } from "./interfaces";

const ShExUtil = require("@shexjs/core").Util;

const TypescriptVisitor = ShExUtil.Visitor();

TypescriptVisitor.generateImports = () => {
  return [generateRdfImport(), BasicShapeInterface];
};

TypescriptVisitor._visitValue = function (v: any[]) {
  return Array.isArray(v) ? (v.length > 1 ? v.join("\n") : v.join("")) : v;
};

TypescriptVisitor.visitSchema = function (schema: any, fileName: string) {
  ShExUtil._expect(schema, "type", "Schema");
  const shapeDeclarations = this.visitShapes(
    schema["shapes"],
    schema._prefixes,
    fileName
  );
  return shapeDeclarations;
};

TypescriptVisitor.visitExpression = function (expr: any, context?: any) {
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

TypescriptVisitor.visitOneOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) =>
      mapOneOfExpressions(this, expression, context)
    ),
  };

  visited.generated = generateExpressions(visited.expressions, " | ");
  visited.extras = generateExtras(visited.expressions);
  visited.inlineEnums = reduceInlineEnums(visited.expressions);
  visited.nameContext = reduceNameContexts(visited.expressions);

  return visited;
};

TypescriptVisitor.visitEachOf = function (expr: any, context?: any) {
  const visited: Record<string, any> = {
    expressions: expr.expressions.map((expression: any) =>
      mapEachOfExpression(this, expression, context)
    ),
  };

  const generatedExpressions = generateExpressions(visited.expressions);
  visited.generated = generatedExpressions && putInBraces(generatedExpressions);
  visited.extras = generateExtras(visited.expressions);
  visited.inlineEnums = reduceInlineEnums(visited.expressions);
  visited.nameContext = reduceNameContexts(visited.expressions);

  return visited;
};

TypescriptVisitor.visitTripleConstraint = function (expr: any, context?: any) {
  const visited = {
    ...expr,
    expression: maybeGenerate(this, expr, TripleConstraintMembers, {
      ...context,
      predicate: expr.predicate,
    }),
  };
  const { valueExpr } = visited.expression;
  const { inlineEnum, inlineEnums } = valueExpr ?? {};

  visited.inlineEnums = inlineEnum ? [inlineEnum] : inlineEnums;
  visited.typeValue = generateValueExpression(valueExpr, context);

  const comment = generateCommentFromAnnotations(visited.annotations);
  visited.generated = generateTripleConstraint(
    valueExpr,
    visited.typeValue,
    visited.predicate,
    comment,
    visited.min > 0 || (!visited.min && !visited.max),
    visited.max === -1
  );

  if (valueExpr?.generatedShape) {
    visited.nameContext = {
      ...valueExpr.nameContext,
      ...predicateToNameContext(expr, context?.prefixes),
    };
  } else {
    visited.nameContext = predicateToNameContext(expr, context?.prefixes);
  }

  if (context?.extra?.includes(visited.predicate) && !valueExpr.values) {
    visited.extra = visited.generated;
    visited.generated = "";
  }

  return visited;
};

TypescriptVisitor.visitNodeConstraint = function (shape: any, context: any) {
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
    visited.typeValue = generateTsType(visited.expression);
  }

  return visited;
};

TypescriptVisitor.visitShape = function (shape: any, context: any) {
  ShExUtil._expect(shape, "type", "Shape");
  shape.expression.expressions = normalizeDuplicateProperties(
    shape.expression.expressions
  );

  const visited = maybeGenerate(this, shape, ShapeMembers, context);
  const {
    generated,
    extras,
    extra,
    inlineEnums,
    type,
    nameContext,
  } = visited.expression;

  // look for extras
  const generatedExtras = extras ?? (extra && putInBraces(extra));

  // generate shape from visited expression
  let generatedShape = generateShape(type, generated, generatedExtras);

  return { ...visited, generatedShape, inlineEnums, nameContext };
};

TypescriptVisitor.visitShapes = function (shapes: any[], prefixes: any) {
  if (shapes === undefined) return undefined;
  const nameContexts: Record<string, string>[] = [];
  let inlineEnums: Record<string, any[]> = {};

  const visited = shapes.map((shape: any) => {
    if (shape.values) {
      return generateEnumExport("", shape.values, prefixes, shape.id);
    }

    const visitedShape = this.visitShapeDecl({ ...shape, prefixes: prefixes });

    if (visitedShape.inlineEnums) {
      inlineEnums = addUniqueInlineEnums(inlineEnums, visitedShape.inlineEnums);
    }

    nameContexts.push({ id: visitedShape.id, ...visitedShape.nameContext });

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

  const generatedNameContexts = generateNameContextsExport(nameContexts);

  const generatedInlineEnums = Object.keys(inlineEnums).map((key) =>
    generateEnumExport(key, inlineEnums[key], prefixes)
  );

  return [
    ...generatedShapes,
    ...generatedInlineEnums,
    ...generatedNameContexts,
  ];
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

export default TypescriptVisitor;
