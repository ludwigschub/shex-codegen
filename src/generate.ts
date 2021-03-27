#!/usr/bin/env node

import ShExParser from "@shexjs/parser";
import { readFileSync, appendFile, mkdirSync, statSync } from "fs";
import path from "path";
import prettier from "prettier";
import find from "findit";

import { readConfig } from "./config";

interface CodegenConfig {
  schema: string;
  generates: Record<string, string[]>;
  matchSuffix?: string;
}

export const generate = (
  schema?: string,
  generates?: Record<string, string[]>,
  config?: CodegenConfig
) =>
  new Promise((resolve, reject) => {
    config = config ?? readConfig() ?? ({ schema, generates } as CodegenConfig);
    schema = schema ?? config.schema;
    generates = generates ?? config.generates;
    if (!schema || !generates || !config) {
      reject(
        `No valid config found at ${process.cwd()}shex-codegen.yml or passed as an argument`
      );
    }

    const generated: Promise<string>[] = [];
    const generatesFiles = Object.keys(generates as Record<string, any>);

    const workPath = config.schema ?? process.cwd();
    const stats = statSync(workPath);

    const visitors: Record<string, any> = Object.assign(
      {},
      ...generatesFiles.map((key) => ({
        [key]: generates[key].map((visitor: string) => {
          const visitorPath = "./visitors/" + visitor + ".js";
          return require(visitorPath).default;
        }),
      }))
    );

    const visitFile = (generates: string, schema: string) => {
      visitors[generates].forEach((visitor: any) => {
        generated.push(readAndGenerateShex(visitor, schema, generates));
      });
    };

    if (!stats.isDirectory()) {
      generatesFiles.forEach((file: string) => {
        visitFile(file, workPath);
        resolve(Promise.all(generated));
      });
    } else {
      const finder = find(workPath);

      // The listeners for files found
      finder.on("file", async function (file: string) {
        if (file.endsWith(config.matchSuffix ?? "shex")) {
          generatesFiles.forEach((generatesFile: string) => {
            visitFile(generatesFile, file);
            resolve(Promise.all(generated));
          });
        }
      });

      finder.on("end", function () {
        resolve(Promise.all(generated));
      });
    }
  });

const readAndGenerateShex = async (
  visitor: any,
  file: string,
  generates: string
) => {
  // Read shape file
  const shapeFile = readFileSync(file, { encoding: "utf8" });

  // Parse and visit shape
  const parser = ShExParser.construct(
    "https://shaperepo.com/schemas/solidProfile#",
    null,
    { index: true }
  );
  const shapeSchema = parser.parse(shapeFile);
  const generated = visitor.visitSchema(shapeSchema);
  const formatted = await writeShapeFile(file, generated, generates);

  return formatted;
};

const writeShapeFile = (file: string, content: string, generates: string) => {
  return new Promise<string>(async (resolve, reject) => {
    // prettier formatting
    const prettierConfig = await prettier.resolveConfig(process.cwd());

    const generatedDir = path.join(process.cwd(), generates);
    let stats;

    try {
      stats = statSync(generatedDir);
    } catch {}

    let filepath = generates ?? "generated.ts";
    if ((!stats && !filepath.endsWith(".ts")) || stats?.isDirectory()) {
      if (!stats) {
        mkdirSync(generatedDir, { recursive: true });
      }
      filepath = path.join(generatedDir, `${getFileName(file)}.ts`);
      const formatted = prettier.format(content, {
        ...prettierConfig,
        filepath,
      });
      appendFile(filepath, formatted, "binary", (err) => {
        err ? reject(err) : resolve(formatted);
      });
    } else {
      filepath = generates;
      const formatted = prettier.format(content, {
        ...prettierConfig,
        filepath,
      });
      appendFile(filepath, formatted, "binary", (err) => {
        console.debug(err);
        err ? reject(err) : resolve(formatted);
      });
    }
  });
};

const getFileName = (file: string) => path.parse(file).name;

// if used from node cli
if (require.main === module) {
  generate();
}
