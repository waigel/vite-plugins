import { antdPreset } from "@hiogawa/unocss-preset-antd";
import {
  defineConfig,
  presetIcons,
  presetUno,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss";

export default defineConfig({
  content: {
    filesystem: ["src/**/*.tsx"],
  },
  presets: [antdPreset(), presetUno(), presetIcons()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
});