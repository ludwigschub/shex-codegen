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

_visitor.visitShape = function (shape: any) {
  ShExUtil._expect(shape, "type", "Shape");

  const shapeDeclaration = maybeGenerate(this, shape, [
    "id",
    "abstract",
    "extends",
    "closed",
    "expression",
    "extra",
    "semActs",
    "annotations",
  ]);

  console.debug(shapeDeclaration);

  return shapeDeclaration.expression?.expressions
    ? shapeDeclaration.expression?.expressions.length > 1
      ? shapeDeclaration.expression.expressions.join("\n")
      : shapeDeclaration.expression.expressions.join("")
    : '';
};

_visitor.visitShapes = function (shapes: any[]) {
  if (shapes === undefined) return undefined;
  return shapes.map(
    (shapeExpr: any) => `export type ${new URL(shapeExpr?.id).hash.replace(
      "#",
      ""
    )} = {
    ${this.visitShapeDecl(shapeExpr)}
}`
  );
};

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
