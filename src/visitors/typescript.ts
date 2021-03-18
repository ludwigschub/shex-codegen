import camelcase from "camelcase";
import path from "path";

const ns = require("own-namespace")();

const ShExUtil = require("@shexjs/core").Util;

const _visitor = ShExUtil.Visitor();

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

_visitor.visitShapeExpr = function (expr: any | string, label: any) {
  if (isShapeRef(expr)) return this.visitShapeRef(expr);
  return expr.type === "Shape"
    ? this.visitShape(expr, label)
    : expr.type === "NodeConstraint"
    ? this.visitNodeConstraint(expr, label)
    : expr.type === "ShapeAnd"
    ? this.visitShapeAnd(expr, label)
    : expr.type === "ShapeOr"
    ? this.visitShapeOr(expr, label)
    : expr.type === "ShapeNot"
    ? this.visitShapeNot(expr, label)
    : expr.type === "ShapeExternal"
    ? this.visitShapeExternal(expr)
    : (function () {
        throw Error("unexpected shapeExpr type: " + expr.type);
      })();
};

_visitor._visitValue = function (v: any[]) {
  return Array.isArray(v) ? (v.length > 1 ? v.join("\n") : v.join("")) : v;
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

  const predicateUrl = new URL(visited.predicate);

  return `${
    camelcase(predicateUrl.hash === ""
      ? path.parse(predicateUrl.pathname).name
      : predicateUrl.hash.replace(/#+/, ""))
  }: ${generateTsType(visited.valueExpr)} ${
    comment ? "// " + comment.object.value : ""
  }`;
};

_visitor._visitGroup = function (expr: any) {
  const visited = maybeGenerate(this, expr, [
    "id",
    "min",
    "max",
    "onShapeExpression",
    "annotations",
    "semActs",
  ]);
  return visited;
};

_visitor.visitShape = function (shape: any) {
  ShExUtil._expect(shape, "type", "Shape");

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

  return visited.expression?.expressions
    ? visited.expression?.expressions.length > 1
      ? visited.expression.expressions.join("\n\t")
      : visited.expression.expressions.join("")
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
  var type = '';
  if (
    valueExpr?.nodeKind === "iri" ||
    valueExpr?.nodeKind === "literal" ||
    valueExpr?.datatype === ns.xsd("string")
  ) {
    type = "string";
  } else if (valueExpr.datatype === ns.xsd('integer')) {
    type = "number";
  } else if (valueExpr.datatype === ns.xsd('dateTime')) {
    type = "Date";
  } else if (valueExpr.datatype) {
    type = valueExpr?.datatype;
  } else if (valueExpr.values) {
    type = valueExpr?.values.length > 1
      ? `[${valueExpr?.values
          .map((value: any, index: number) =>
            index !== valueExpr.values.length - 1
              ? `'${value}', `
              : `'${value}'`
          )
          .join("")}]`
      : `['${valueExpr.values[0]}']`;
  } else if (typeof valueExpr === 'string') {
    type = new URL(valueExpr).hash.replace(/#+/, ""))
  }
  return type + ';'
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

export const TypescriptVisitor = _visitor;

export default _visitor;

function isShapeRef(expr: any | string) {
  return typeof expr === "string"; // test for JSON-LD @ID
}
