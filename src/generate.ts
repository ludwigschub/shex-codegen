import ShExParser from "@shexjs/parser";
import { readFileSync, writeFile, existsSync, mkdirSync } from "fs";
import path from "path";
import find from "findit";

import TypescriptVisitor from "./visitors/typescript";

export const generate = async (
  dir?: string,
  outDir?: string,
  suffix?: string
) => {
  const finder = find(dir ?? process.cwd());

  //This listens for files found
  finder.on("file", function (file: string) {
    if (file.endsWith(suffix ?? "shex")) {
      readAndGenerateShex(file, outDir);
    }
  });
};

const readAndGenerateShex = async (file: string, outDir?: string) => {
  // Read shape file
  const shapeFile = readFileSync(file, { encoding: "utf8" });

  // Parse shape
  const parser = ShExParser.construct(
    "https://shaperepo.com/schemas/solidProfile#",
    null,
    { index: true }
  );
  const shapeSchema = parser.parse(shapeFile);
  const types = TypescriptVisitor.visitSchema(shapeSchema);
  await writeShapeFile(file, JSON.stringify(types), outDir);
};

const writeShapeFile = (file: string, content: string, outDir?: string) => {
  return new Promise<void>((resolve, reject) => {
    const generatedDir = path.join(process.cwd(), outDir ?? "/generated/");
    if (!existsSync(generatedDir)) {
      mkdirSync(generatedDir);
    }
    writeFile(
      path.join(generatedDir, `${getFileName(file)}.ts`),
      content,
      (err) => (err ? reject(err) : resolve())
    );
  });
};

const getFileName = (file: string) => path.parse(file).name;
