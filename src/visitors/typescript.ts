import camelcase from "camelcase";
import path from "path";

const ns = require("own-namespace")();

const ShExUtil = require("@shexjs/core").Util;

const _visitor = ShExUtil.Visitor();

_visitor._visitValue = function (v: any[]) {
  return Array.isArray(v) ? (v.length > 1 ? v.join("\n") : v.join("")) : v;
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

_visitor.visitSchema = function (schema: any) {
  ShExUtil._expect(schema, "type", "Schema");
  const shapeDeclarations = this.visitShapes(schema["shapes"]);
  return shapeDeclarations.join("\n");
};

_visitor.visitExpression = function (expr: any) {
  if (typeof expr === "string") return this.visitInclusion(expr);
  const visited =
    expr.type === "TripleConstraint"
      ? this.visitTripleConstraint(expr)
      : expr.type === "OneOf"
      ? this.visitOneOf(expr)
      : expr.type === "EachOf"
      ? this.visitEachOf(expr)
      : null;
  if (visited === null) throw Error("unexpected expression type: " + expr.type);
  else return visited;
};

_visitor.visitOneOf = function (expr: any) {
  const required = expr.min > 0;
  const predicate = expr.expressions.find((expr: any) => expr.predicate)
    ?.predicate;
  if (predicate) {
    const generated = `\t${normalizeUrl(predicate)}${
      !required ? "?" : ""
    }: (${expr.expressions
      .map((expression: any, index: number) => {
        let type;
        if (expression.type === "EachOf") {
          type = this.visitEachOf(expression);
        } else if (expression.type === "OneOf") {
          type = this.visitOneOf(expression);
        } else {
          type = generateTsType(expression.valueExpr);
        }
        return `${type}${index === expr.expressions.length - 1 ? "" : " | "}`;
      })
      .join("")})`;
    return this._maybeSet(
      expr,
      Object.assign("id" in expr ? { id: null, generated } : { generated }, {
        type: expr.type,
      }),
      "expr",
      ["id", "min", "max", "onShapeExpression", "annotations", "semActs"],
      ["expressions"]
    );
  } else {
    return "lala";
  }
};

_visitor.visitEachOf = function (expr: any) {
  const generated = `{
${expr.expressions
  .map((expression: any) => {
    const required = expression.min > 0;
    const predicate = expression.predicate;

    if (expression.type === "TripleConstraint") {
      return `\t${this.visitTripleConstraint(expression).generated}`;
    }

    let type: any = {};
    if (expression.type === "EachOf") {
      type = this.visitEachOf(expression);
    } else if (expression.type === "OneOf") {
      type = this.visitOneOf(expression);
    }

    if (predicate) {
      return `${normalizeUrl(predicate)}${!required ? "?" : ""}: ${
        type.generated
      }`;
    } else {
      return `${type.generated};`;
    }
  })
  .join("\n")}
}`;

  return this._maybeSet(
    expr,
    Object.assign("id" in expr ? { id: null, generated } : { generated }, {
      type: expr.type,
    }),
    "expr",
    ["id", "min", "max", "onShapeExpression", "annotations", "semActs"],
    ["expressions"]
  );
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

  const generated = `${normalizeUrl(visited.predicate)}${
    !required ? "?" : ""
  }: ${generateTsType(visited.valueExpr)}${multiple ? ` | ${type}[]` : ""}; ${
    comment ? "// " + comment.object.value : ""
  }`.trim();

  return this._maybeSet(
    expr,
    Object.assign(
      // pre-declare an id so it sorts to the top
      "id" in expr ? { id: null, generated } : { generated },
      { type: "TripleConstraint" }
    ),
    "TripleConstraint",
    [
      "id",
      "inverse",
      "predicate",
      "valueExpr",
      "min",
      "max",
      "onShapeExpression",
      "annotations",
      "semActs",
    ],
    ["expressions"]
  );
};

_visitor.visitShape = function (shape: any) {
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

  if (visited.expression.type === "TripleConstraint") {
    console.debug(visited.expression);
    return `{
  ${visited.expression.generated}
}`;
  }

  return visited.expression?.generated;
};

_visitor.visitShapes = function (shapes: any[]) {
  if (shapes === undefined) return undefined;
  return shapes.map(
    (shapeExpr: any) =>
      `export type ${normalizeUrl(shapeExpr.id)} = ${this.visitShapeDecl(
        shapeExpr
      )}\n`
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
    try {
      return normalizeUrl(valueExpr);
    } catch {
      return valueExpr
        .trim()
        .substr(valueExpr.lastIndexOf(":") + 1, valueExpr.length - 1);
    }
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

function normalizeUrl(url: string) {
  const predicateUrl = new URL(url);
  return camelcase(
    predicateUrl.hash === ""
      ? path.parse(predicateUrl.pathname).name
      : predicateUrl.hash.replace(/#+/, "")
  );
}

export const TypescriptVisitor = _visitor;

export default _visitor;
