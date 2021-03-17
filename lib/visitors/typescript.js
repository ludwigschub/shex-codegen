"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypescriptVisitor = void 0;
const ShExUtil = require("@shexjs/core").Util;
const _visitor = ShExUtil.Visitor();
_visitor.visitSchema = function (schema) {
    ShExUtil._expect(schema, "type", "Schema");
    const shapeDeclarations = this.visitShapes(schema["shapes"]);
    return shapeDeclarations.join("\n");
};
_visitor.visitShapes = function (shapes) {
    var _Visitor = this;
    if (shapes === undefined)
        return undefined;
    return shapes.map((shapeExpr) => `export type ${new URL(shapeExpr?.id).hash.replace("#", "")} = {
    ${_Visitor.visitShapeDecl(shapeExpr)}
}`);
};
exports.TypescriptVisitor = _visitor;
exports.default = _visitor;
//# sourceMappingURL=typescript.js.map