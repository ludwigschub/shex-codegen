import { readFileSync } from 'fs';
import path from 'path';

import yaml from 'js-yaml';

export type Config = { schema: string; generates: Record<string, string[]> };

export const readConfig = () => {
  try {
    const { schema, generates } = yaml.load(
      readFileSync(path.join(process.cwd(), 'shex-codegen.yml'), {
        encoding: 'utf8',
      }),
      { json: true },
    ) as Config;
    return { schema, generates };
  } catch {
    return;
  }
};
