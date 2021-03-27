import { readFileSync } from "fs";
import path from "path";
import yaml from "js-yaml";

export const readConfig = () => {
  try {
    const { schema, generates } = yaml.load(
      readFileSync(path.join(process.cwd(), "shex-codegen.yml"), {
        encoding: "utf8",
      }),
      { json: true }
    ) as { schema: string; generates: Record<string, string[]> };
    return { schema, generates };
  } catch {
    return;
  }
};
