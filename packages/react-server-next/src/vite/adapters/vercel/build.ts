import { existsSync } from "node:fs";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PrerenderEntry } from "@hiogawa/react-server/server";

const configJson = {
  version: 3,
  trailingSlash: false,
  routes: [
    {
      src: "^/assets/(.*)$",
      headers: {
        "cache-control": "public, immutable, max-age=31536000",
      },
    },
    {
      handle: "filesystem",
    },
    {
      src: ".*",
      dest: "/",
    },
  ],
  overrides: {},
};

// edge only for now
const vcConfigJson = {
  runtime: "edge",
  entrypoint: "index.js",
};

export async function build() {
  const buildDir = join(process.cwd(), "dist");
  const outDir = join(process.cwd(), ".vercel/output");

  // clean
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  // overrides for ssg html
  // https://vercel.com/docs/build-output-api/v3/configuration#overrides
  const prerenderManifest = await getPrerenderManifest(buildDir);
  configJson.overrides = Object.fromEntries(
    prerenderManifest.map((e) => [e.html.slice(1), { path: e.route }]),
  );

  // config
  await writeFile(
    join(outDir, "config.json"),
    JSON.stringify(configJson, null, 2),
  );

  // static
  await mkdir(join(outDir, "static"), { recursive: true });
  await cp(join(buildDir, "client"), join(outDir, "static"), {
    recursive: true,
  });

  // function config
  await mkdir(join(outDir, "functions/index.func"), { recursive: true });
  await writeFile(
    join(outDir, "functions/index.func/.vc-config.json"),
    JSON.stringify(vcConfigJson, null, 2),
  );

  // bundle function
  const esbuild = await import("esbuild");
  const result = await esbuild.build({
    entryPoints: [join(buildDir, "server/index.js")],
    outfile: join(outDir, "functions/index.func/index.js"),
    metafile: true,
    bundle: true,
    minify: true,
    format: "esm",
    platform: "node",
    define: {
      "process.env.NODE_ENV": `"production"`,
    },
    logOverride: {
      "ignored-bare-import": "silent",
    },
  });
  await writeFile(
    join(buildDir, "esbuild-metafile.json"),
    JSON.stringify(result.metafile),
  );
}

async function getPrerenderManifest(buildDir: string) {
  const file = join(buildDir, "client/__prerender.json");
  if (!existsSync(file)) {
    return [];
  }
  const data = JSON.parse(await readFile(file, "utf-8"));
  return data as PrerenderEntry[];
}
