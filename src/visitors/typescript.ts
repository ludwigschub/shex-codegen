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

_visitor.visitExpression = function (expr: any, id?: string) {
  if (typeof expr === "string") return this.visitInclusion(expr);
  const visited =
    expr.type === "TripleConstraint"
      ? this.visitTripleConstraint(expr, id)
      : expr.type === "OneOf"
      ? this.visitOneOf(expr, id)
      : expr.type === "EachOf"
      ? this.visitEachOf(expr, id)
      : null;
  if (visited === null) throw Error("unexpected expression type: " + expr.type);
  else return visited;
};

_visitor.visitOneOf = function (expr: any, id?: string) {
  const visited = expr.expressions.map((expression: any) => {
    if (expression.type === "TripleConstraint") {
      return this.visitTripleConstraint(expression, id);
    }

    if (expression.type === "EachOf") {
      return this.visitEachOf(expression);
    } else if (expression.type === "OneOf") {
      return this.visitOneOf(expression);
    }
  });

  const generated = `(${visited
    .map((expression: any) => expression.generated)
    .join(" | ")})`;

  const inlineEnums = visited
    .reduce(
      (inlineEnums: any[], expression: any) =>
        expression.inlineEnum
          ? [...inlineEnums, expression.inlineEnum]
          : inlineEnums,
      []
    )
    .join("\n");

  return this._maybeSet(
    expr,
    Object.assign(
      "id" in expr
        ? { id: null, generated, inlineEnums }
        : { generated, inlineEnums },
      {
        type: expr.type,
      }
    ),
    "expr",
    ["id", "min", "max", "onShapeExpression", "annotations", "semActs"],
    ["expressions"]
  );
};

_visitor.visitEachOf = function (expr: any, id?: string) {
  const visited = expr.expressions.map((expression: any) => {
    if (expression.type === "TripleConstraint") {
      return this.visitTripleConstraint(expression, id);
    }

    if (expression.type === "EachOf") {
      return this.visitEachOf(expression);
    } else if (expression.type === "OneOf") {
      return this.visitOneOf(expression);
    }
  });

  const generated = `{
  ${visited.map((expression: any) => expression.generated).join("\n\t")}
}`;

  const inlineEnums = visited
    .reduce(
      (inlineEnums: any[], expression: any) =>
        expression.inlineEnum
          ? [...inlineEnums, expression.inlineEnum]
          : inlineEnums,
      []
    )
    .join("\n");

  return this._maybeSet(
    expr,
    Object.assign(
      "id" in expr
        ? { id: null, generated, inlineEnums }
        : { generated, inlineEnums },
      {
        type: expr.type,
      }
    ),
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

_visitor.visitTripleConstraint = function (expr: any, id?: string) {
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

  let inlineEnum = "";
  let type = "";
  if (visited.valueExpr.values) {
    type = generateEnumName(
      id as string,
      normalizeUrl(visited.predicate, true)
    );
    inlineEnum = `export enum ${type} ${generateEnumValues(
      visited.valueExpr.values
    )}`;
  } else {
    type = generateTsType(visited.valueExpr);
  }

  const generated = `${normalizeUrl(visited.predicate)}${
    !required ? "?" : ""
  }: ${type}${multiple ? ` | ${type}[]` : ""}; ${
    comment ? "// " + comment.object.value : ""
  }`.trim();

  return this._maybeSet(
    expr,
    Object.assign(
      // pre-declare an id so it sorts to the top
      "id" in expr
        ? { id: null, generated, inlineEnum }
        : { generated, inlineEnum },
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

  let generated = visited.expression.generated;
  const inlineEnums =
    visited.expression.inlineEnums ?? visited.expression.inlineEnum;

  if (visited.expression?.type === "TripleConstraint") {
    generated = `{
  ${visited.expression.generated}
}`;
  }

  return inlineEnums
    ? `${generated}\n
${inlineEnums}`
    : generated;
};

_visitor.visitShapes = function (shapes: any[]) {
  if (shapes === undefined) return undefined;

  return shapes.map((shapeExpr: any) => {
    if (shapeExpr.values) {
      return `export enum ${generateEnumName(
        shapeExpr.id
      )} ${generateEnumValues(shapeExpr.values)}\n`;
    }

    return `export type ${normalizeUrl(
      shapeExpr.id,
      true
    )} = ${this.visitShapeDecl(shapeExpr)}\n`;
  });
};

function generateEnumValues(values: any) {
  return `{
${values
  .map((value: string) => `\t${normalizeUrl(value)} = '${value}'`)
  .join(",\n")}
}`;
}

function generateEnumName(name: string, suffix = "") {
  return normalizeUrl(name, true) + suffix;
}

function generateTsType(valueExpr: any) {
  if (
    valueExpr?.nodeKind === "iri" ||
    valueExpr?.nodeKind === "literal" ||
    valueExpr?.datatype === ns.xsd("string")
  ) {
    return "string";
  } else if (valueExpr?.datatype === ns.xsd("integer")) {
    return "number";
  } else if (valueExpr?.datatype === ns.xsd("dateTime")) {
    return "Date";
  } else if (valueExpr?.datatype) {
    return valueExpr?.datatype;
  } else if (typeof valueExpr === "string") {
    try {
      return normalizeUrl(valueExpr, true);
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
      var t = f.call(Visitor, obj[member], obj?.id);
      if (t !== undefined) {
        generated[member] = t;
      }
    }
  });
  return generated;
}

function normalizeUrl(url: string, capitalize?: boolean) {
  const predicateUrl = new URL(url);
  const normalized = camelcase(
    predicateUrl.hash === ""
      ? path.parse(predicateUrl.pathname).name
      : predicateUrl.hash.replace(/#+/, "")
  );
  return capitalize
    ? normalized.replace(/^\w/, (c) => c.toUpperCase())
    : normalized;
}

export const TypescriptVisitor = _visitor;

export default _visitor;
