import { spawn } from "child_process";

import chalk from "chalk";

import { generate } from "./generate";
import { readConfig } from "./config";

const log = console.log;

function spawnCodegenDemon(watch: string) {
  const cp = spawn(
    "nodemon",
    ["--ext", "*.shex", "--watch", "shex-codegen.yml", "--watch", watch],
    {
      // the important part is the 4th option 'ipc'
      // this way `process.send` will be available in the child process (nodemon)
      // so it can communicate back with parent process (through `.on()`, `.send()`)
      // https://nodejs.org/api/child_process.html#child_process_options_stdio
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    }
  );
  console.clear();

  return cp;
}

export function watch(schema?: string) {
  const config = readConfig();
  schema = schema ?? config?.schema ?? process.cwd();
  const app = spawnCodegenDemon(schema);

  app.on("message", function (event: { type: string; data: string[] }) {
    if (event.type === "restart") {
      console.clear();
      log(`shex-codegen is watching ${schema}...\n`);
      if (Array.isArray(event.data)) {
        log(chalk.yellow("Restarted") + " due to changes in:\n");
        event.data.forEach((file: string) => {
          log(chalk.yellow(file));
        });
        log("\n");

        generate(schema);
        log(chalk.green("Generated") + " types for everything specified by:\n");
        event.data.forEach((file: string) => {
          log(chalk.green(file) + "\n");
        });
      }
    }
  });

  // force a restart
  app.send("restart");
  
  return app;
}
