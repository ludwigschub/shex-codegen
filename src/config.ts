import { readFileSync } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

export type GeneratorConfig = Record<string, string[]>

export interface CustomImportConfig {
  customMethodsImport?: string
  customRdfImport?: string
}

export interface CodegenConfig extends CustomImportConfig {
  schema: string;
  generates: GeneratorConfig;
  matchSuffix?: string;
}

export const readConfig = () => {
  try {
    const { schema, generates } = yaml.load(
      readFileSync(path.join(process.cwd(), 'shex-codegen.yml'), {
        encoding: 'utf8',
      }),
      { json: true },
    ) as CodegenConfig;
    return { schema, generates };
  } catch {
    return;
  }
};
