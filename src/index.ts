#!/usr/bin/env node

import { generate } from "./generate";
import { watch } from "./watch";

// if used from node cli
if (require.main === module) {
  const scriptOption = process.argv[2];
  const validScripts = ["generate", "watch"];
  if (!validScripts.includes(scriptOption)) {
    throw Error(
      "Valid scripts include: " +
        validScripts.join(", ") +
        "\n " +
        scriptOption +
        " is unknown"
    );
  }
  switch (scriptOption) {
    case "generate":
      generate(process.argv[3]);
      break;
    case "watch":
      watch(process.argv[3]);
      break;
  }
}

export * from "./generate";
export * from "./watch";
