import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const dir = join(tmpdir(), "debate-the-wizard-function-tests");
const outfile = join(dir, "unit.mjs");

await rm(dir, { recursive: true, force: true });
await mkdir(dir, { recursive: true });

await build({
  entryPoints: ["backend/functions/tests/unit.ts"],
  outfile,
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  legalComments: "none",
});

await import(pathToFileURL(outfile).href);
