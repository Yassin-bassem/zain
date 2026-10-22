import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  edgeExternals: ["pg-cloudflare"],
});
