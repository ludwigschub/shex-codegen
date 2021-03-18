import camelcase from "camelcase";
import path from "path";

const ns = require("own-namespace")();

const ShExUtil = require("@shexjs/core").Util;

const _visitor = ShExUtil.Visitor();

_visitor._visitValue = function (v: any[]) {
  return Array.isArray(v) ? (v.length > 1 ? v.join("\n") : v.join("")) : v;
};

_visitor.visitSchema = function (schema: any) {
  ShExUtil._expect(schema, "type", "Schema");
  const shapeDeclarations = this.visitShapes(schema["shapes"]);
  return shapeDeclarations.join("\n");
};

_visitor.visitShapeDecl = function (decl: any, label: string) {
  return decl.type === "ShapeDecl"
    ? `id: ${this._visitValue(decl["id"])}
${this._visitValue(decl["abstract"])}
${this._visitShapeExprList(decl["restricts"])}
${this.visitShapeExpr(decl["shapeExpr"])}
`
    : `${this.visitShapeExpr(decl, label)}`;
};

_visitor.visitTripleConstraint = function (expr: any) {
  const visited = maybeGenerate(this, expr, [
    "id",
    "inverse",
    "predicate",
    "valueExpr",
    "min",
    "max",
    "onShapeExpression",
    "annotations",
    "semActs",
  ]);
  const comment = visited.annotations?.find(
    (annotation: any) => annotation.predicate === ns.rdfs("comment")
  );

  const required = visited.min > 0;

  const multiple = visited.max === -1;

  const type = generateTsType(visited.valueExpr);

  return `${normalizePredicate(visited.predicate)}${
    required ? "?" : ""
  }: ${generateTsType(visited.valueExpr)}${multiple ? ` | ${type}[]` : ""}; ${
    comment ? "// " + comment.object.value : ""
  }`;
};

_visitor.visitShape = function (shape: any) {
  ShExUtil._expect(shape, "type", "Shape");

  shape.expression.expressions = shape.expression.expressions?.reduce(
    (currentExpressions: any[], currentExpression: any) => {
      const duplicate = currentExpressions?.find(
        (expression) => expression.predicate === currentExpression.predicate
      );
      console.debug(currentExpressions);
      return duplicate
        ? [
            ...currentExpressions.filter(
              (expression) => expression.predicate !== duplicate.predicate
            ),
            {
              ...currentExpression,
              valueExpr:
                duplicate?.valueExpr.values &&
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

  const visited = maybeGenerate(this, shape, [
    "id",
    "abstract",
    "extends",
    "closed",
    "expression",
    "extra",
    "semActs",
    "annotations",
  ]);

  const expressions = visited.expression?.expressions;

  return expressions
    ? expressions.length > 1
      ? expressions.join("\n\t")
      : expressions.join("")
    : "";
};

_visitor.visitShapes = function (shapes: any[]) {
  if (shapes === undefined) return undefined;
  return shapes.map(
    (shapeExpr: any) => `export type ${new URL(shapeExpr?.id).hash.replace(
      /#+/,
      ""
    )} = {
  ${this.visitShapeDecl(shapeExpr)}
}\n`
  );
};

function generateTsType(valueExpr: any) {
  if (
    valueExpr?.nodeKind === "iri" ||
    valueExpr?.nodeKind === "literal" ||
    valueExpr?.datatype === ns.xsd("string")
  ) {
    return "string";
  } else if (valueExpr.datatype === ns.xsd("integer")) {
    return "number";
  } else if (valueExpr.datatype === ns.xsd("dateTime")) {
    return "Date";
  } else if (valueExpr.datatype) {
    return valueExpr?.datatype;
  } else if (valueExpr.values) {
    return valueExpr?.values.length > 1
      ? `[${valueExpr?.values
          .map((value: any, index: number) =>
            index !== valueExpr.values.length - 1
              ? `'${value}', `
              : `'${value}'`
          )
          .join("")}]`
      : `['${valueExpr.values[0]}']`;
  } else if (typeof valueExpr === "string") {
    return new URL(valueExpr).hash.replace(/#+/, "");
  }
}

function maybeGenerate(Visitor: any, obj: any, members: string[]) {
  const generated: Record<string, any> = {};
  members.forEach(function (member) {
    var methodName = "visit" + member.charAt(0).toUpperCase() + member.slice(1);
    if (member in obj) {
      var f = Visitor[methodName];
      if (typeof f !== "function") {
        throw Error(methodName + " not found in Visitor");
      }
      var t = f.call(Visitor, obj[member]);
      if (t !== undefined) {
        generated[member] = t;
      }
    }
  });
  return generated;
}

function normalizePredicate(predicate: string) {
  const predicateUrl = new URL(predicate);
  return camelcase(
    predicateUrl.hash === ""
      ? path.parse(predicateUrl.pathname).name
      : predicateUrl.hash.replace(/#+/, "")
  );
}

export const TypescriptVisitor = _visitor;

export default _visitor;
