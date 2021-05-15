import ShExParser from '@shexjs/parser';
import prettier from 'prettier/standalone';
import prettierTypescript from 'prettier/parser-typescript';
import { generateShexExport } from './visitors/typescript/generates';

export type BrowserConfig = {
  schema: string;
  visitors: string[];
  name: string;
};

export const generate = ({ schema, visitors, name }: BrowserConfig) => {
  const visitorsClasses = visitors.map((visitor: string) => {
    const visitorPath = `./visitors/${visitor}/${visitor}.js`;
    return require(visitorPath).default;
  });
  const generated = visitorsClasses.map((visitor: any, index: number) => {
    // Parse and visit shape
    const parser = ShExParser.construct('http://example.com/', null, {
      index: true,
    });
    const shapeSchema = parser.parse(schema);
    const generated = visitor.visitSchema(shapeSchema, name);
    if (index === 0) {
      return [...generated, generateShexExport(name, schema)].join('\n');
    } else {
      return generated.join('\n');
    }
  });

  const imports = visitorsClasses.reduce(
    (allImports: string[], visitor: any) => {
      const visitorImport =
        visitor?.generateImports && visitor?.generateImports().join('\n');
      return visitorImport ? [...allImports, visitorImport] : allImports;
    },
    [],
  );

  return prettier.format([...imports, ...generated].join('\n'), {
    singleQuote: true,
    parser: 'typescript',
    plugins: [prettierTypescript],
  });
};
