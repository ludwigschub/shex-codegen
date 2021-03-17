import ShExParser from "@shexjs/parser";
import { readFile, writeFile } from "fs";
import TypescriptVisitor from "./visitors/typescript";

export const generate = async () => {
  // Read shape file
  const shapeFile = await new Promise<String>((resolve, reject) =>
    readFile("./shapes/solidProfile.shex", "utf8", (err, data) =>
      err ? reject(err) : resolve(data)
    )
  );
  // Parse shape
  const parser = ShExParser.construct(
    "https://shaperepo.com/schemas/solidProfile#",
    null,
    { index: true }
  );
  const shapeSchema = parser.parse(shapeFile);
  const types = TypescriptVisitor.visitSchema(shapeSchema);
  await new Promise<void>((resolve, reject) =>
    writeFile("./generated/solidProfile.ts", JSON.stringify(types), (err) =>
      err ? reject(err) : resolve()
    )
  );
};
