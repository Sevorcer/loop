// Generates public/sw.js from scripts/sw.template.js, baking a per-deploy build
// id into the service worker cache name.
//
// Wired as the npm `prebuild` script, so it runs automatically before
// `next build` (including on Vercel). Vercel exposes VERCEL_GIT_COMMIT_SHA on
// every build, so each deploy produces a byte-different sw.js with a unique
// cache name. The byte change makes browsers re-install the SW, and the unique
// cache name makes `activate` purge every previous build's cache.
//
// Locally (and in CI without a git sha) the build id falls back to "dev", which
// keeps the committed public/sw.js byte-stable so it does not show up as a
// spurious git diff after a local build.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BUILD_ID_TOKEN = "__LOOP_BUILD_ID__";

/**
 * Resolve the per-deploy build id from the environment.
 * Priority: Vercel commit sha -> explicit LOOP_BUILD_ID override -> "dev".
 * The result is lowercased, stripped to [a-z0-9], and truncated so it is a safe
 * Cache Storage key segment.
 */
export function resolveBuildId(env = process.env) {
  const raw = env.VERCEL_GIT_COMMIT_SHA || env.LOOP_BUILD_ID || "";
  const cleaned = String(raw).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return cleaned || "dev";
}

/**
 * Render the service worker source by replacing every build-id token in the
 * template. Throws if the template has no token, so a broken template fails the
 * build loudly instead of shipping an unversioned SW.
 */
export function renderServiceWorker(template, buildId) {
  if (!template.includes(BUILD_ID_TOKEN)) {
    throw new Error(
      `sw.template.js is missing the ${BUILD_ID_TOKEN} token; refusing to generate an unversioned service worker`
    );
  }
  return template.split(BUILD_ID_TOKEN).join(buildId);
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const templatePath = join(scriptDir, "sw.template.js");
  const outputPath = join(scriptDir, "..", "public", "sw.js");

  const template = readFileSync(templatePath, "utf8");
  const buildId = resolveBuildId();
  const output = renderServiceWorker(template, buildId);

  writeFileSync(outputPath, output);
  // eslint-disable-next-line no-console
  console.log(`[generate-sw] wrote public/sw.js (cache "loop-pwa-${buildId}")`);
}

// Only run the file-writing side effect when invoked directly (so the pure
// helpers above can be imported by tests without touching the filesystem).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
