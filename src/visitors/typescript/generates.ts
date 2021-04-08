import { normalizeUrl } from "../common";

const ns = require("own-namespace")();

export function putInBraces(expr: string) {
  return `{\n${expr}\n}`;
}

export function generateShexExport(name: string, shex: string) {
  return `export const ${generateShexName(name)} = \`
${shex}
\`\n`
}

export function generateShexName(name: string) {
  return name + "Shex";
}

export function generateShapeExport(name: string, shape: string) {
  return `export type ${name} = ${shape} & BasicShape;\n`;
}

export function generateShape(type: string, shape: string, extras: string) {
  if (type === "TripleConstraint") {
    return !!shape ? putInBraces(shape) : extras;
  }
  if (extras) {
    if (shape) {
      return `${shape} & (${extras})`;
    } else {
      return extras;
    }
  }

  return shape;
}

export function generateEnumExport(
  name: string,
  values: string[],
  prefixes: Record<string, string>,
  id?: string
) {
  return `export enum ${id ? generateEnumName(id) : name} ${generateEnumValues(
    values,
    prefixes
  )};\n`;
}

export function generateNameContextExport(
  id: string,
  nameContext: Record<string, string>
) {
  return `export enum ${generateNameContextName(
    id
  )} ${generateNameContextValues(nameContext)}\n`;
}

export function generateExpressions(expressions: any[], join?: string) {
  return expressions
    .filter((expression: any) => !!expression.generated)
    .map((expression: any) => expression.generated)
    .join(join ?? "\n");
}

export function generateExtras(expressions: any[], join?: string) {
  return expressions
    .reduce(
      (extras: any[], expression: any) =>
        expression.extra
          ? [...extras, expression.extra]
          : expression.extras
          ? [...extras, expression.extras]
          : extras,
      []
    )
    .join(join ?? " & ");
}

export function generateEnumName(url?: string, predicate?: string) {
  if (url && !predicate) {
    return normalizeUrl(url as string, true);
  } else if (url && predicate && normalizeUrl(predicate) === "type") {
    return normalizeUrl(url as string, true) + normalizeUrl(predicate, true);
  } else if (predicate) {
    return normalizeUrl(predicate, true) + "Type";
  } else
    throw Error("Can't generate enum name without a subject or a predicate");
}

export function generateEnumValues(
  values: any,
  prefixes: Record<string, string>
) {
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
        normalizedValue = normalizeUrl(value, true, normalizedValue, prefixes);
        return { name: normalizedValue, value: value };
      }
      return { name: normalizedValue, value: value };
    })
    .map((value: any) => `${value.name} = "${value.value}"`)
    .join(",\n")}
  }`;
}

export function generateNameContextName(id: string) {
  return normalizeUrl(id, true) + "Context";
}

export function generateNameContextValues(
  nameContext: Record<string, string>
) {
  return `{
  ${Object.keys(nameContext).map((key: string) => `${key} = "${nameContext[key]}"`).join(",\n")}
  }`;
}

export function generateCommentFromAnnotations(annotations: any[]) {
  const comment = annotations?.find(
    (annotation: any) => annotation.predicate === ns.rdfs("comment")
  );
  const commentValue = comment ? "// " + comment.object.value : "";
  return commentValue;
}

export function generateTripleConstraint(
  valueExpr: any,
  typeValue: string,
  predicate: string,
  comment: string,
  required: boolean,
  multiple: boolean
) {
  if (multiple) {
    typeValue += ` | ${
      valueExpr?.nodeKind === "iri" || !valueExpr?.values
        ? `(${typeValue})`
        : typeValue
    }[]`;
  }

  return `${normalizeUrl(predicate)}${
    !required ? "?" : ""
  }: ${typeValue}; ${comment}`.trim();
}

export function generateValues(
  values: string[],
  typeValue: string,
  context: any
) {
  if (values.length > 1) {
    return `(${values
      .map((value: string, index: number) => {
        const otherValue = values.find(
          (otherValue: string, otherIndex: number) =>
            index !== otherIndex &&
            normalizeUrl(otherValue, true) === normalizeUrl(value, true)
        );
        return `${typeValue}.${normalizeUrl(
          value,
          true,
          otherValue ? normalizeUrl(otherValue, true) : "",
          context?.prefixes
        )}`;
      })
      .join(" | ")})[]`;
  } else {
    return `${typeValue}.${normalizeUrl(
      values[0],
      true,
      undefined,
      context?.prefixes
    )}`;
  }
}

export function generateValueExpression(valueExpr: any, context: any) {
  if (typeof valueExpr === "string") {
    return generateTsType(valueExpr);
  } else if (valueExpr?.typeValue) {
    if (valueExpr.expression.values) {
      return generateValues(
        valueExpr.expression.values,
        valueExpr.typeValue,
        context
      );
    } else {
      return valueExpr.typeValue;
    }
  } else if (valueExpr?.generatedShape) {
    return valueExpr?.generatedShape;
  } else {
    return "string";
  }
}

export function generateTsType(valueExpr: any) {
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
