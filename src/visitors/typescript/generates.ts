import { normalizeUrl } from "../common";

const ns = require("own-namespace")();

export function generateEnumValues(values: any, prefixes: any) {
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
