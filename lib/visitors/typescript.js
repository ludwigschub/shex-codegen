"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypescriptVisitor = void 0;
const ShExUtil = require("@shexjs/core").Util;
const _visitor = ShExUtil.Visitor();
_visitor.visitSchema = function (schema) {
    var ret = { type: "Schema" };
    ShExUtil._expect(schema, "type", "Schema");
    this._maybeSet(schema, ret, "Schema", ["@context", "prefixes", "base", "imports", "startActs", "start", "shapes"], ["_base", "_prefixes", "_index", "_sourceMap"]);
    return ret;
};
exports.TypescriptVisitor = _visitor;
exports.default = _visitor;
//# sourceMappingURL=typescript.js.map