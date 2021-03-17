const ShExUtil = require("@shexjs/core").Util;

const _visitor = ShExUtil.Visitor();

_visitor.visitSchema = function (schema: any) {
  var ret = { type: "Schema" };
  ShExUtil._expect(schema, "type", "Schema");
  this._maybeSet(
    schema,
    ret,
    "Schema",
    ["@context", "prefixes", "base", "imports", "startActs", "start", "shapes"],
    ["_base", "_prefixes", "_index", "_sourceMap"]
  );
  return ret;
};

export const TypescriptVisitor = _visitor;

export default _visitor;
