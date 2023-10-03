import { existsSync, readFileSync, rmSync, statSync } from 'fs';
import path from 'path';

import ShExParser from '@shexjs/parser';
import find from 'findit';
import { outputFile } from 'fs-extra';
import prettier from 'prettier';

import { CodegenConfig, GeneratorConfig, readConfig } from './config';
import { generateShexExport } from './visitors';

export const generate = (
  schema?: string,
  generates?: GeneratorConfig,
  config?: CodegenConfig,
): Promise<string[]> =>
  new Promise(async (resolve, reject) => {
    // Prioritise function args over config file
    config = config ?? readConfig() ?? ({ schema, generates } as CodegenConfig);
    schema = schema ?? config.schema;
    generates = generates ?? config.generates;
    if (!schema || !generates || !config) {
      reject(
        `No valid config found at ${process.cwd()}shex-codegen.yml or passed as an argument`,
      );
    }

    const { customMethodsImport, customRdfImport } = config
    const generatesFiles = Object.keys(generates as Record<string, any>);
    const generated: Record<string, Record<string, Promise<string>[]>> = {};

    // delete possibly previously generated files
    generatesFiles.forEach((file: string) => {
      const exists = existsSync(file)
      if (exists) {
        rmSync(file);
      }
    });

    const workPath = schema ?? process.cwd();
    if (!existsSync(workPath)) {
      resolve([]);
      return
    }
    const stats = statSync(workPath);

    const visitors: Record<string, any> = Object.assign(
      {},
      ...generatesFiles.map((key) => ({
        [key]: (generates as GeneratorConfig)[key].map(
          (visitor: string) => {
            const visitorPath = `./visitors/${visitor}/${visitor}.js`;
            return require(visitorPath).default;
          },
        ),
      })),
    );

    const visitFile = (generates: string, schemaFile: string) => {
      if (
        !path.parse(generates).ext ||
        (path.parse(generates).ext !== '.ts' &&
          path.parse(generates).ext !== '.tsx')
      ) {
        throw Error(
          'Unsupported file extension: ' +
          path.parse(generates).ext +
          '. Supported types are .ts & .tsx.',
        );
      }
      const schemaName = path.parse(schemaFile).name;
      if (!generated[generates]) generated[generates] = {};
      visitors[generates].forEach((visitor: any, visitorIndex: number) => {
        const generatedCode = readShexAndGenerate(visitor, schemaFile, visitorIndex === 0)
        if (
          generatedCode &&
          schemaName in
          (generated[generates] as Record<string, Promise<string>[]>)
        ) {
          generated[generates][schemaName].push(
            generatedCode,
          );
        } else if (generatedCode) {
          generated[generates][schemaName] = [
            generatedCode,
          ];
        }
      });
    };

    const writeGenerated = async () => {
      return Promise.all(
        generatesFiles.map((file: string) => {
          const sortedGenerated = Object.values(
            sortObject(generated[file]) as Record<string, Promise<string>[]>,
          ).reduce(
            (allGenerating: Promise<string>[], generate: Promise<string>[]) => [
              ...allGenerating,
              ...generate,
            ],
            [],
          );
          return Promise.all(sortedGenerated).then((generated): Promise<string> => {
            const imports = visitors[file].reduce(
              (allImports: string[], visitor: any) => {
                const visitorImport =
                  visitor?.generateImports &&
                  visitor?.generateImports({ customMethodsImport, customRdfImport }).join('\n');
                return visitorImport
                  ? [...allImports, visitorImport]
                  : allImports;
              },
              [],
            );
            const generatedCode = [...imports, ...generated].join(
              '\n',
            ) as string;
            if ((generated.filter(Boolean)).length > 0) {
              return writeShapesFile(file, generatedCode);
            }
            return Promise.resolve("")
          });
        }),
      ).then((results) => results.filter(Boolean));
    };

    if (!stats.isDirectory()) {
      generatesFiles.forEach((file: string) => {
        visitFile(file, workPath);
      });
      resolve(await writeGenerated());
    } else {
      const finder = find(workPath);

      // The listeners for files found
      finder.on('file', async function (file: string) {
        if (file.endsWith(config?.matchSuffix ?? 'shex')) {
          generatesFiles.forEach((generatesFile: string) => {
            visitFile(generatesFile, file);
          });
        }
      });

      finder.on('end', async function () {
        resolve(await writeGenerated());
      });
    }
  });

const readShexAndGenerate = async (
  visitor: any,
  file: string,
  generateShex?: boolean,
) => {
  // Read shape file
  const shapeFile = readFileSync(file, { encoding: 'utf8' });

  // Parse and visit shape
  const parser = ShExParser.construct('http://example.com/', null, {
    index: true,
  });
  const shapeSchema = parser.parse(shapeFile);
  const fileName = path.parse(file).name;
  const generated = visitor.visitSchema(shapeSchema, fileName) ?? [];

  if (generated.length === 0) {
    return ""
  }

  if (generateShex) {
    return [...generated, generateShexExport(fileName, shapeFile)].join('\n');
  } else {
    return generated.join('\n');
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

    outputFile(generates, formatted, 'utf-8', (err) => {
      err ? reject(err) : resolve(formatted);
    });
  });
};

const sortObject = (unordered: Record<string, any>) => {
  return Object.keys(unordered)
    .sort()
    .reduce((obj: Record<string, any>, key: string) => {
      obj[key] = unordered[key];
      return obj;
    }, {});
};
