const ShExUtil = require("@shexjs/core").Util;

const _visitor = ShExUtil.Visitor();

_visitor.visitSchema = function (schema: any) {
  ShExUtil._expect(schema, "type", "Schema");
  const shapeDeclarations = this.visitShapes(schema["shapes"]);
  return shapeDeclarations.join("\n");
};

_visitor.visitShapes = function (shapes: any[]) {
  var _Visitor = this;
  if (shapes === undefined) return undefined;
  return shapes.map(
    (shapeExpr: any) => `export type ${new URL(shapeExpr?.id).hash.replace(
      "#",
      ""
    )} = {
    ${_Visitor.visitShapeDecl(shapeExpr)}
}`
  );
};

export const TypescriptVisitor = _visitor;

export default _visitor;
