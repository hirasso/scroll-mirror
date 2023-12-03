import { defineConfig } from "astro/config";
import expressiveCode from "astro-expressive-code";
import mdx from "@astrojs/mdx";

/** @type {import('astro-expressive-code').AstroExpressiveCodeOptions} */
const expressiveCodeOptions = {
  styleOverrides: {
    frames: {
      tooltipSuccessBackground: "#60ddcd",
      tooltipSuccessForeground: "black",
    },
  },
  // theme: 'dracula',
};

// https://astro.build/config
export default defineConfig({
  site: "https://hirasso.github.io",
  base: "/scrollmirror",
  server: { port: 8274, host: true },
  integrations: [expressiveCode(expressiveCodeOptions), mdx()],
});
