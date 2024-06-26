import path from "node:path";
import { vitePluginReactServer } from "@hiogawa/react-server/plugin";
import {
  vitePluginLogger,
  vitePluginSsrMiddleware,
} from "@hiogawa/vite-plugin-ssr-middleware";
import react from "@vitejs/plugin-react";
import type { Plugin, PluginOption } from "vite";

export default function vitePluginReactServerNext(options?: {
  plugins?: PluginOption[];
}): PluginOption {
  return [
    react(),
    vitePluginReactServer({
      routeDir: "app",
      entryBrowser: `next/vite/entry-browser`,
      entryServer: "next/vite/entry-server",
      plugins: [nextEsbuildJsx, ...(options?.plugins ?? [])],
    }),
    vitePluginLogger(),
    vitePluginSsrMiddleware({
      entry: "next/vite/entry-ssr",
      preview: path.resolve("./dist/server/index.js"),
    }),
    {
      name: "next-exclude-optimize",
      config: () => ({
        ssr: {
          noExternal: ["next"],
        },
        optimizeDeps: {
          exclude: ["next"],
        },
      }),
    },
  ];
}

// overrdied next.js's default `jsx: preserve`
const nextEsbuildJsx: Plugin = {
  name: "next-esbuild-jsx",
  config: () => ({
    esbuild: {
      jsx: "automatic",
    },
    optimizeDeps: { esbuildOptions: { jsx: "automatic" } },
  }),
};
