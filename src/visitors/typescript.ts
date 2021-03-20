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

_visitor.visitShapeExpr = function (expr: any, context: any) {
  if (isShapeRef(expr)) return this.visitShapeRef(expr);
  var r =
    expr.type === "Shape"
      ? this.visitShape(expr, context)
      : expr.type === "NodeConstraint"
      ? this.visitNodeConstraint(expr, context)
      : expr.type === "ShapeAnd"
      ? this.visitShapeAnd(expr, context)
      : expr.type === "ShapeOr"
      ? this.visitShapeOr(expr, context)
      : expr.type === "ShapeNot"
      ? this.visitShapeNot(expr, context)
      : expr.type === "ShapeExternal"
      ? this.visitShapeExternal(expr)
      : null; // if (expr.type === "ShapeRef") r = 0; // console.warn("visitShapeExpr:", r);
  if (r === null) throw Error("unexpected shapeExpr type: " + expr.type);
  else return r;
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

  visited.generated = `${visited
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join(" | ")}`;

  visited.extras = visited
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
    .filter(
      (expression: any) =>
        !!expression.valueExpr?.inlineEnum ||
        !!expression.valueExpr?.inlineEnums
    )
    .reduce(
      (inlineEnums: any, expression: any) =>
        expression.valueExpr.inlineEnum
          ? [...inlineEnums, expression.valueExpr.inlineEnum]
          : expression.valueExpr.inlineEnums
          ? [...inlineEnums, ...expression.valueExpr.inlineEnums]
          : inlineEnums,
      []
    );

  if (Object.keys(inlineEnums).length > 0) {
    visited.inlineEnums = inlineEnums;
  }

  return visited;
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

  visited.generated = `{
  ${visited
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join("\n\t")}
}`;

  visited.extras = visited
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
    .filter(
      (expression: any) =>
        !!expression.valueExpr?.inlineEnum ||
        !!expression.valueExpr?.inlineEnums
    )
    .reduce(
      (inlineEnums: any, expression: any) =>
        expression.valueExpr.inlineEnum
          ? [...inlineEnums, expression.valueExpr.inlineEnum]
          : expression.valueExpr.inlineEnums
          ? [...inlineEnums, ...expression.valueExpr.inlineEnums]
          : inlineEnums,
      []
    );

  if (Object.keys(inlineEnums).length > 0) {
    visited.inlineEnums = inlineEnums;
  }

  return visited;
};

_visitor.visitTripleConstraint = function (expr: any, context?: any) {
  const members = [
    "id",
    "inverse",
    "predicate",
    "valueExpr",
    "min",
    "max",
    "onShapeExpression",
    "annotations",
    "semActs",
  ];
  const visited = {
    ...expr,
    ...maybeGenerate(this, expr, members, {
      ...context,
      predicate: expr.predicate,
    }),
  };

  if (typeof visited.valueExpr === "string") {
    visited.typeValue = generateTsType(visited.valueExpr);
  } else if (visited.valueExpr.typeValue) {
    visited.inlineEnum = visited.valueExpr.inlineEnum;
    visited.typeValue = visited.valueExpr.typeValue;
  } else {
    visited.typeValue = visited.valueExpr.generatedShape;
  }

  const comment = visited.annotations?.find(
    (annotation: any) => annotation.predicate === ns.rdfs("comment")
  );
  const commentValue = comment ? "// " + comment.object.value : "";

  const required = visited.min > 0;

  const multiple = visited.max === -1;
  if (multiple) {
    visited.typeValue += ` | ${
      visited.valueExpr.nodeKind === "iri" ? `(${visited.typeValue})` : visited.typeValue
    }[]`;
  }

  visited.generated = `${normalizeUrl(visited.predicate)}${
    !required ? "?" : ""
  }: ${visited.typeValue}; ${commentValue}`.trim();

  if (
    context?.extra?.includes(visited.predicate) &&
    !visited.valueExpr.values
  ) {
    visited.extra = visited.generated;
    visited.generated = "";
  }

  return visited;
};

_visitor.visitNodeConstraint = function (shape: any, context: any) {
  ShExUtil._expect(shape, "type", "NodeConstraint");

  const members = [
    "id",
    "nodeKind",
    "datatype",
    "pattern",
    "flags",
    "length",
    "reference",
    "minlength",
    "maxlength",
    "mininclusive",
    "minexclusive",
    "maxinclusive",
    "maxexclusive",
    "totaldigits",
    "fractiondigits",
    "values",
    "annotations",
    "semActs",
  ];

  const visited = maybeGenerate(this, shape, members, context);

  if (visited.values) {
    visited.typeValue = generateEnumName(
      context.id as string,
      context.predicate
    );
    visited.inlineEnum = {
      [visited.typeValue]: [
        ...visited.values,
        ...(context.inlineEnums ? context.inlineEnums[visited.typeValue] : []),
      ],
    };
  } else {
    visited.typeValue = generateTsType(visited);
  }

  return visited;
};

_visitor.visitShape = function (shape: any, context: any) {
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

  const visited = maybeGenerate(
    this,
    shape,
    [
      "id",
      "abstract",
      "extends",
      "closed",
      "expression",
      "semActs",
      "annotations",
    ],
    context
  );

  const extras = visited.expression.extras ?? visited.expression.extra;
  const { generated, inlineEnums, inlineEnum } = visited.expression;
  visited.generatedShape = extras
    ? generated
      ? `${generated} & (${extras})`
      : `${extras}`
    : generated;

  visited.inlineEnums = inlineEnums ?? (inlineEnum ? [inlineEnum] : null);

  if (visited.expression?.type === "TripleConstraint") {
    if (context?.id) {
      visited.generatedShape = `{\n\t\t${visited.expression.generated}\n\t}`;
    } else {
      visited.generatedShape = `{\n\t${visited.expression.generated}\n}`;
    }
  }

  return visited;
};

_visitor.visitShapes = function (shapes: any[], prefixes: any) {
  if (shapes === undefined) return undefined;
  const inlineEnums: Record<string, any[]> = {};

  const visited = shapes.map((shape: any) => {
    if (shape.values) {
      return `export enum ${generateEnumName(shape.id)} ${generateEnumValues(
        shape.values,
        prefixes
      )};\n`;
    }

    const visitedShape = this.visitShapeDecl({ ...shape, prefixes: prefixes });

    if (visitedShape.inlineEnums) {
      visitedShape.inlineEnums.forEach((inlineEnum: any) => {
        Object.keys(inlineEnum).forEach((enumKey: string) => {
          if (!inlineEnums[enumKey]) {
            inlineEnums[enumKey] = inlineEnum[enumKey];
          } else {
            inlineEnums[enumKey] = Object.values(
              Object.assign(
                {},
                ...inlineEnum[enumKey].map((value: string) => ({
                  [value]: value,
                })),
                ...inlineEnums[enumKey].map((value) => ({
                  [value]: value,
                }))
              )
            );
          }
        });
      });
    }

    return { id: shape.id, ...visitedShape };
  });

  const generatedShapes = visited.map((shape: any | string) => {
    if (typeof shape === "string") {
      return shape;
    } else {
      return `export type ${normalizeUrl(shape.id, true)} = ${
        shape.generatedShape
      };\n`;
    }
  });

  const generatedInlineEnums = Object.keys(inlineEnums).map((key) => {
    return `export enum ${key} ${generateEnumValues(
      inlineEnums[key],
      prefixes
    )};\n`;
  });

  return [...generatedShapes, ...generatedInlineEnums];
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
  .map((value: any) => `\t${value.name} = "${value.value}"`)
  .join(",\n")}
}`;
}

function generateEnumName(url?: string, predicate?: string) {
  if (url && !predicate) {
    return normalizeUrl(url as string, true);
  } else if (url && predicate && normalizeUrl(predicate) === "type") {
    return normalizeUrl(url as string, true) + normalizeUrl(predicate, true);
  } else if (predicate) {
    return normalizeUrl(predicate, true) + "Type";
  } else
    throw Error("Can't generate enum name without a subject or a predicate");
}

function generateTsType(valueExpr: any) {
  if (
    valueExpr?.nodeKind === "literal" ||
    valueExpr?.datatype === ns.xsd("string")
  ) {
    return "string";
  } else if (valueExpr?.nodeKind === "iri") {
    return "string | URL";
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

function maybeGenerate(
  Visitor: any,
  obj: any,
  members: string[],
  context?: any
) {
  const generated: Record<string, any> = {};
  members.forEach(function (member) {
    var methodName = "visit" + member.charAt(0).toUpperCase() + member.slice(1);
    if (member in obj) {
      var f = Visitor[methodName];
      if (typeof f !== "function") {
        throw Error(methodName + " not found in Visitor");
      }
      var t = f.call(
        Visitor,
        obj[member],
        context ?? {
          id: obj?.id,
          prefixes: obj?.prefixes,
          extra: obj?.extra,
        }
      );
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

function isShapeRef(expr: any) {
  return typeof expr === "string"; // test for JSON-LD @ID
}

export const TypescriptVisitor = _visitor;

export default _visitor;
