import { defineConfig } from "astro/config";
import expressiveCode from "astro-expressive-code";

// https://astro.build/config
export default defineConfig({
  server: { port: 8274, host: true },
  integrations: [expressiveCode()],
});
