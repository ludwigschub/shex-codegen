import { normalizeUrl } from "../common";

const ns = require("own-namespace")();

export function generateEnum(
  id: string,
  values: string[],
  prefixes: Record<string, string>
) {
  return `export enum ${generateEnumName(id)} ${generateEnumValues(
    values,
    prefixes
  )};\n`;
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
    .map((value: any) => `  ${value.name} = "${value.value}"`)
    .join(",\n")}
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
    if (valueExpr.values) {
      return generateValues(valueExpr.values, valueExpr.typeValue, context);
    } else {
      return valueExpr.typeValue;
    }
  } else if (valueExpr?.generatedShape) {
    if (valueExpr.expression.generated) {
      return valueExpr.extras
        ? valueExpr.generatedShape ?? "" + valueExpr.extras
        : valueExpr.generatedShape;
    }
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
