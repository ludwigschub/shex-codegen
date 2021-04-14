import { normalizeUrl } from "../common";
import {
  generateNameContextName,
  generateShexName,
} from "../typescript/generates";

export function generateShapeMethodsExport(
  {
    id,
    childShapes,
    typed,
  }: {
    id: string;
    childShapes: string[] | undefined;
    typed: boolean | undefined;
  },
  fileName: string
) {
  const shape = `
export const ${normalizeUrl(id).replace(
    "Shape",
    ""
  )} = new Shape<${normalizeUrl(id, true)}>({
  id: "${id}",
  shape: ${generateShexName(fileName)},
  context: ${generateNameContextName(id)},
  ${typed ? `type: ${normalizeUrl(id, true) + "Type"},` : ""}
  ${
    Array.isArray(childShapes) && childShapes.length > 0
      ? `childContexts: [${childShapes
          .map((shape) => generateNameContextName(shape))
          .join(", ")}],`
      : ""
  }
})\n`;

  return shape;
}

export function generateShapeMethodsImport() {
  return `import { Shape } from "shex-methods";\n`;
}
