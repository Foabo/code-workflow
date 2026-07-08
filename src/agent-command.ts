#!/usr/bin/env node
import { main } from "./cli/agent-command.js";

main(process.argv).then((code) => {
  process.exitCode = code;
});
