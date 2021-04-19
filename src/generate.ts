import ShExParser from "@shexjs/parser";
import { readFileSync, rmSync, statSync } from "fs";
import { outputFile } from "fs-extra";
import prettier from "prettier";
import find from "findit";
import path from "path";

import { readConfig } from "./config";
import { generateShexExport } from "./visitors";

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
  new Promise(async (resolve, reject) => {
    // Prioritise function args over config file
    config = config ?? readConfig() ?? ({ schema, generates } as CodegenConfig);
    schema = schema ?? config.schema;
    generates = generates ?? config.generates;
    if (!schema || !generates || !config) {
      reject(
        `No valid config found at ${process.cwd()}shex-codegen.yml or passed as an argument`
      );
    }

    const generatesFiles = Object.keys(generates as Record<string, any>);
    const generated: Record<string, Promise<string>[]> = {};

    // delete possibly previously generated files
    generatesFiles.forEach((file: string) => {
      try {
        rmSync(file);
      } catch {}
    });

    const workPath = schema ?? process.cwd();
    const stats = statSync(workPath);

    const visitors: Record<string, any> = Object.assign(
      {},
      ...generatesFiles.map((key) => ({
        [key]: (generates as Record<string, string[]>)[key].map(
          (visitor: string) => {
            const visitorPath = `./visitors/${visitor}/${visitor}.js`;
            return require(visitorPath).default;
          }
        ),
      }))
    );

    const visitFile = (generates: string, schemaFile: string) => {
      if (
        !path.parse(generates).ext ||
        (path.parse(generates).ext !== ".ts" &&
          path.parse(generates).ext !== ".tsx")
      ) {
        throw Error(
          "Unsupported file extension: " +
            path.parse(generates).ext +
            ". Supported types are .ts & .tsx."
        );
      }
      visitors[generates].forEach((visitor: any, visitorIndex: number) => {
        if ((generated[generates] as Promise<string>[] | undefined)?.push)
          generated[generates]?.push(
            readShexAndGenerate(visitor, schemaFile, visitorIndex === 0)
          );
        else
          generated[generates] = [
            readShexAndGenerate(visitor, schemaFile, visitorIndex === 0),
          ];
      });
    };

    const writeGenerated = async () => {
      return Promise.all(
        generatesFiles.map((file: string) => {
          return Promise.all(generated[file]).then((generated) => {
            const imports = visitors[file].reduce(
              (allImports: string[], visitor: any) => {
                const visitorImport =
                  visitor?.generateImports &&
                  visitor?.generateImports().join("\n");
                return visitorImport
                  ? [...allImports, visitorImport]
                  : allImports;
              },
              []
            );
            const generatedContent = [...imports, ...generated].join(
              "\n"
            ) as string;
            return writeShapesFile(file, generatedContent);
          });
        })
      );
    };

    if (!stats.isDirectory()) {
      generatesFiles.forEach((file: string) => {
        visitFile(file, workPath);
      });
      resolve(await writeGenerated());
    } else {
      const finder = find(workPath);

      // The listeners for files found
      finder.on("file", async function (file: string) {
        if (file.endsWith(config?.matchSuffix ?? "shex")) {
          generatesFiles.forEach((generatesFile: string) => {
            visitFile(generatesFile, file);
          });
        }
      });

      finder.on("end", async function () {
        resolve(await writeGenerated());
      });
    }
  });

const readShexAndGenerate = async (
  visitor: any,
  file: string,
  generateShex?: boolean
) => {
  // Read shape file
  const shapeFile = readFileSync(file, { encoding: "utf8" });

  // Parse and visit shape
  const parser = ShExParser.construct("http://example.com/", null, {
    index: true,
  });
  const shapeSchema = parser.parse(shapeFile);
  const fileName = path.parse(file).name;
  const generated = visitor.visitSchema(shapeSchema, fileName);

  if (generateShex) {
    return [...generated, generateShexExport(fileName, shapeFile)].join("\n");
  } else {
    return generated.join("\n");
  }
};

const writeShapesFile = (generates: string, content: string) => {
  return new Promise<string>(async (resolve, reject) => {
    // prettier formatting
    const prettierConfig = await prettier.resolveConfig(process.cwd());
    const formatted = prettier.format(content, {
      ...prettierConfig,
      filepath: generates,
    });

    outputFile(generates, formatted, "utf-8", (err) => {
      err ? reject(err) : resolve(formatted);
    });
  });
};
