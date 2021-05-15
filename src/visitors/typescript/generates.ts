import { normalizeUrl } from "../common";

const ns = require("own-namespace")();

const idField = "id: string; // the url of a node of this shape";
const idFieldToCreate =
  "id?: string | NamedNode; // the url to match or create the node with e.g. 'https://example.com#this', 'https://example.com/profile/card#me'";

export function putInBraces(expr: string, wrapInParentheses?: boolean) {
  if (wrapInParentheses) return `({\n${expr}\n})`;
  return `{\n${expr}\n}`;
}

export function generateRdfImport() {
  return `import { NamedNode, Literal } from "rdflib"; \n`;
}

export function generateShexExport(name: string, shex: string) {
  return `export const ${generateShexName(name)} = \`
${shex}
\`\n`;
}

export function generateShexName(name: string) {
  return name + "Shex";
}

export function generateShapeExport(name: string, shape: string) {
  return `export type ${name} = ${shape};\n`;
}

export function generateShape(
  type: string,
  shape: string,
  extras: string,
  toCreate?: boolean
) {
  if (type === "TripleConstraint") {
    return shape
      ? putInBraces([toCreate ? idFieldToCreate : idField, shape].join("\n"))
      : extras;
  }

  if (
    extras &&
    extras !== putInBraces(idField, true) &&
    extras !== putInBraces(idFieldToCreate, true)
  ) {
    if (shape) {
      return `${shape} & ${extras}`;
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

export function generateNameContextsExport(
  nameContexts: Record<string, string>[]
) {
  return nameContexts.map((nameContext) => {
    const { id, ...context } = nameContext;
    return `export enum ${generateNameContextName(
      id
    )} ${generateNameContextValues(context)}\n`;
  });
}

export function generateExpressions(
  expressions: any[],
  join?: string,
  toCreate?: boolean
) {
  const generated = [
    {
      [toCreate ? "generatedToCreate" : "generated"]: join?.includes("|")
        ? null
        : toCreate
        ? idFieldToCreate
        : idField,
    },
    ...expressions,
  ]
    .filter((expression) =>
      toCreate ? !!expression.generatedToCreate : !!expression.generated
    )
    .map((expression: any) =>
      toCreate ? expression.generatedToCreate : expression.generated
    );
  if (generated.length === 0) return putInBraces(idField);
  if (join?.includes("|"))
    return `${putInBraces(idField)} & (${generated.join(join)})`;
  return generated.join(join ?? "\n");
}

export function generateExtras(
  expressions: any[],
  join?: string,
  toCreate?: boolean
) {
  return expressions
    .reduce((extras: any[], expression: any) => {
      if (toCreate) {
        return expression.extraToCreate
          ? [...extras, expression.extraToCreate]
          : expression.extrasToCreate
          ? [...extras, expression.extrasToCreate]
          : extras;
      }
      return expression.extra
        ? [...extras, expression.extra]
        : expression.extras
        ? [...extras, expression.extras]
        : extras;
    }, [])
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

export function generateNameContextValues(nameContext: Record<string, string>) {
  return `{
  ${Object.keys(nameContext)
    .map((key: string) => `${key} = "${nameContext[key]}"`)
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

export function generateValueExpression(
  valueExpr: any,
  context: any,
  toCreate?: boolean
) {
  if (typeof valueExpr === "string") {
    return generateTsType(valueExpr, toCreate);
  } else if (valueExpr?.typeValue) {
    if (valueExpr.expression.values) {
      return generateValues(
        valueExpr.expression.values,
        valueExpr.typeValue,
        context
      );
    } else {
      return toCreate ? valueExpr.typeValueToCreate : valueExpr.typeValue;
    }
  } else if (valueExpr?.generatedShape) {
    return toCreate
      ? valueExpr.generatedShapeToCreate
      : valueExpr.generatedShape;
  } else {
    return "string";
  }
}

export function generateTsType(valueExpr: any, toCreate?: boolean) {
  if (valueExpr?.nodeKind === "iri") {
    return toCreate ? "URL | NamedNode" : "string";
  } else if (numberTypes.includes(valueExpr?.datatype)) {
    return toCreate ? "number | Literal" : "number";
  } else if (valueExpr?.datatype === ns.xsd("dateTime")) {
    return toCreate ? "Date | Literal" : "Date";
  } else if (valueExpr?.datatype === ns.xsd("string")) {
    return toCreate ? "string | Literal" : "string";
  } else if (valueExpr?.datatype) {
    return valueExpr?.datatype;
  } else if (typeof valueExpr === "string") {
    try {
      return toCreate
        ? `URL | NamedNode | ${normalizeUrl(valueExpr, true)}CreateArgs`
        : normalizeUrl(valueExpr, true);
    } catch {
      return valueExpr;
    }
  }
}

const numberTypes = [
  ns.xsd("integer"),
  ns.xsd("decimal"),
  ns.xsd("nonPositiveInteger"),
  ns.xsd("negativeInteger"),
  ns.xsd("long"),
  ns.xsd("int"),
  ns.xsd("short"),
  ns.xsd("byte"),
  ns.xsd("nonNegativeInteger"),
  ns.xsd("unsignedLong"),
  ns.xsd("unsignedInt"),
  ns.xsd("unsignedShort"),
  ns.xsd("unsignedByte"),
  ns.xsd("positiveInteger"),
];
