import "dotenv/config";

import { Template, defaultBuildLogger } from "e2b";

import { template } from "./template";

const TEMPLATE_NAME = "gabatools/devin-sandbox";

async function main() {
  const build = await Template.build(template, TEMPLATE_NAME, {
    cpuCount: 2,
    memoryMB: 512,
    onBuildLogs: defaultBuildLogger(),
  });

  console.log(`Built E2B template ${build.name ?? TEMPLATE_NAME}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
