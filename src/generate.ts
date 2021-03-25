import ShExParser from "@shexjs/parser";
import { readFileSync, writeFile, existsSync, mkdirSync } from "fs";
import path from "path";
import prettier from "prettier";
import find from "findit";

import TypescriptVisitor from "./visitors/typescript";

export const generate = (dir?: string, outDir?: string, suffix?: string) =>
  new Promise((resolve) => {
    const finder = find(dir ?? process.cwd());

    const generated: Promise<string>[] = [];

    //This listens for files found
    finder.on("file", async function (file: string) {
      if (file.endsWith(suffix ?? "shex")) {
        generated.push(readAndGenerateShex(file, outDir));
      }
    });

    finder.on("end", function () {
      resolve(Promise.all(generated));
    });
  });
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
  return await writeShapeFile(file, types, outDir);
};

const writeShapeFile = (file: string, content: string, outDir?: string) => {
  return new Promise<string>(async (resolve, reject) => {
    const generatedDir = path.join(process.cwd(), outDir ?? "/generated/");
    if (!existsSync(generatedDir)) {
      mkdirSync(generatedDir);
    }
    const filepath = path.join(generatedDir, `${getFileName(file)}.ts`);
    const prettierConfig = await prettier.resolveConfig(filepath);
    const formatted = prettier.format(content, { ...prettierConfig, filepath });
    writeFile(filepath, formatted, "binary", (err) =>
      err ? reject(err) : resolve(formatted)
    );
  });
};

const getFileName = (file: string) => path.parse(file).name;
