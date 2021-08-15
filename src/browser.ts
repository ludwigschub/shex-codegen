import ShExParser from '@shexjs/parser';
import prettier from 'prettier/standalone';
import prettierTypescript from 'prettier/parser-typescript';

import { generateShexExport } from './visitors/typescript/generates';

export type BrowserConfig = {
  schema: string;
  visitors: any[];
  name: string;
};

export const generate = ({ schema, visitors, name }: BrowserConfig) => {
  const generated = visitors.map((visitor: any, index: number) => {
    // Parse and visit shape
    const parser = ShExParser.construct('http://example.com/', null, {
      index: true,
    });
    const shapeSchema = parser.parse(schema);
    const generated = visitor.visitSchema(shapeSchema, name) ?? [];
    if (index === 0) {
      return [...generated, generateShexExport(name, schema)].join('\n');
    } else {
      return generated.join('\n');
    }
  });

  const imports = visitors.reduce(
    (allImports: string[], visitor: any) => {
      const visitorImport =
        visitor?.generateImports && visitor?.generateImports().join('\n');
      return visitorImport ? [...allImports, visitorImport] : allImports;
    },
    [],
  );

  if (generated.length === 0) return ""

  return prettier.format([...imports, ...generated].join('\n'), {
    singleQuote: true,
    parser: 'typescript',
    plugins: [prettierTypescript],
  });
};
