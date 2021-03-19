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
  const shapeDeclarations = this.visitShapes(
    schema["shapes"],
    schema._prefixes
  );
  return shapeDeclarations.join("\n");
};

_visitor.visitExpression = function (expr: any, context?: any) {
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

_visitor.visitOneOf = function (expr: any, context?: any) {
  const visited = expr.expressions.map((expression: any) => {
    if (expression.type === "TripleConstraint") {
      const visitedExpression = this.visitTripleConstraint(expression, context);
      visitedExpression.generated = visitedExpression.generated
        ? `{ ${visitedExpression.generated} }`
        : "";
      visitedExpression.extra = visitedExpression.extra
        ? `{ ${visitedExpression.extra} }`
        : "";
      return visitedExpression;
    }

    if (expression.type === "EachOf") {
      return this.visitEachOf(expression, context);
    } else if (expression.type === "OneOf") {
      return this.visitOneOf(expression, context);
    }
  });

  const generated = `${visited
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join(" | ")}`;

  const extras = visited
    .reduce(
      (extras: any[], expression: any) =>
        expression.extra
          ? [...extras, expression.extra]
          : expression.extras
          ? [...extras, expression.extras]
          : extras,
      []
    )
    .join(" | ");

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
        ? { id: null, generated, inlineEnums, extras }
        : { generated, inlineEnums, extras },
      {
        type: expr.type,
      }
    ),
    "expr",
    ["id", "min", "max", "onShapeExpression", "annotations", "semActs"],
    ["expressions"]
  );
};

_visitor.visitEachOf = function (expr: any, context?: any) {
  const visited = expr.expressions.map((expression: any) => {
    if (expression.type === "TripleConstraint") {
      return this.visitTripleConstraint(expression, context);
    }

    if (expression.type === "EachOf") {
      return this.visitEachOf(expression, context);
    } else if (expression.type === "OneOf") {
      return this.visitOneOf(expression, context);
    }
  });

  const generated = `{
  ${visited
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join("\n\t")}
}`;

  const extras = visited
    .reduce(
      (extras: any[], expression: any) =>
        expression.extra
          ? [...extras, expression.extra]
          : expression.extras
          ? [...extras, expression.extras]
          : extras,
      []
    )
    .join(" | ");

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
        ? { id: null, generated, inlineEnums, extras }
        : { generated, inlineEnums, extras },
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

_visitor.visitTripleConstraint = function (expr: any, context?: any) {
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
      context.id as string,
      normalizeUrl(visited.predicate, true)
    );
    inlineEnum = `export enum ${type} ${generateEnumValues(
      visited.valueExpr.values,
      context.prefixes
    )}`;
  } else {
    type = generateTsType(visited.valueExpr);
  }

  let generated = `${normalizeUrl(visited.predicate)}${
    !required ? "?" : ""
  }: ${type}${multiple ? ` | ${type}[]` : ""}; ${
    comment ? "// " + comment.object.value : ""
  }`.trim();

  let extra;
  if (
    context?.extra?.includes(visited.predicate) &&
    !visited.valueExpr.values
  ) {
    extra = generated;
    generated = "";
  }

  return this._maybeSet(
    expr,
    Object.assign(
      // pre-declare an id so it sorts to the top
      "id" in expr
        ? { id: null, generated, inlineEnum, extra }
        : { generated, inlineEnum, extra },
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
    "semActs",
    "annotations",
  ]);

  const extras = visited.expression.extras ?? visited.expression.extra;
  const generated = visited.expression.generated;
  let output = extras
    ? generated
      ? `${generated} & (${extras})`
      : `${extras}`
    : generated;
  const inlineEnums =
    visited.expression.inlineEnums ?? visited.expression.inlineEnum;

  if (visited.expression?.type === "TripleConstraint") {
    output = `{
  ${visited.expression.generated}
}`;
  }

  return inlineEnums
    ? `${output}\n
${inlineEnums}`
    : output;
};

_visitor.visitShapes = function (shapes: any[], prefixes: any) {
  if (shapes === undefined) return undefined;

  return shapes.map((shapeExpr: any) => {
    if (shapeExpr.values) {
      return `export enum ${generateEnumName(
        shapeExpr.id
      )} ${generateEnumValues(shapeExpr.values, prefixes)}\n`;
    }

    return `export type ${normalizeUrl(
      shapeExpr.id,
      true
    )} = ${this.visitShapeDecl({ ...shapeExpr, prefixes: prefixes })}\n`;
  });
};

function generateEnumValues(values: any, prefixes: any) {
  return `{
${values
  .map((value: any, _index: number, values: any[]) => {
    let normalizedValue = normalizeUrl(value, true);
    if (
      values.find(
        (otherValue) =>
          normalizeUrl(otherValue, true) === normalizedValue &&
          otherValue !== value
      )
    ) {
      normalizedValue = normalizeUrl(value, false, normalizedValue, prefixes);
      return { name: normalizedValue, value: value };
    }
    return { name: normalizedValue, value: value };
  })
  .map((value: any) => `\t${value.name} = '${value.value}'`)
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
      return valueExpr;
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
      var t = f.call(Visitor, obj[member], {
        id: obj?.id,
        prefixes: obj?.prefixes,
        extra: obj?.extra,
      });
      if (t !== undefined) {
        generated[member] = t;
      }
    }
  });
  return generated;
}

function normalizeUrl(
  url: string,
  capitalize?: boolean,
  not?: string,
  prefixes?: any
) {
  const urlObject = new URL(url);
  let normalized = camelcase(
    urlObject.hash === ""
      ? path.parse(urlObject.pathname).name
      : urlObject.hash.replace(/#+/, "")
  );

  if (not && normalized.toLowerCase() === not.toLowerCase()) {
    const namespaceUrl = url.replace(
      urlObject.hash === ""
        ? path.parse(urlObject.pathname).name
        : urlObject.hash,
      ""
    );
    const namespacePrefix = Object.keys(prefixes).find(
      (key) => prefixes[key] === namespaceUrl
    );
    normalized =
      namespacePrefix + normalized.replace(/^\w/, (c) => c.toUpperCase());
  }

  if (capitalize) {
    return normalized.replace(/^\w/, (c) => c.toUpperCase());
  }

  return normalized;
}

export const TypescriptVisitor = _visitor;

export default _visitor;
