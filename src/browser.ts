import ShExParser from '@shexjs/parser';
import prettier from 'prettier/standalone';
import prettierTypescript from 'prettier/parser-typescript';

import { generateShexExport } from './visitors/typescript/generates';
import { CustomImportConfig } from './config';

export interface BrowserConfig extends CustomImportConfig {
  schema: string;
  visitors: any[];
  name: string;
};

export const generate = ({ schema, visitors, name, customMethodsImport, customRdfImport }: BrowserConfig) => {
  const generated = visitors.map((visitor: any, index: number) => {
    // Parse and visit shape
    const parser = ShExParser.construct('http://example.com/', null, {
      index: true,
    });
    const shapeSchema = parser.parse(schema);
    const generated = visitor.visitSchema(shapeSchema, name) ?? [];
    if (generated.length === 0) return ""
    if (index === 0) {
      return [...generated, generateShexExport(name, schema)].join('\n');
    } else {
      return generated.join('\n');
    }
  });

  const imports = visitors.reduce(
    (allImports: string[], visitor: any) => {
      const visitorImport =
        visitor?.generateImports && visitor?.generateImports({ customMethodsImport, customRdfImport }).join('\n');
      return visitorImport ? [...allImports, visitorImport] : allImports;
    },
    [],
  );

  if (generated.filter(Boolean).length === 0) return ""

  return prettier.format([...imports, ...generated].join('\n'), {
    singleQuote: true,
    parser: 'typescript',
    plugins: [prettierTypescript],
  });
};
