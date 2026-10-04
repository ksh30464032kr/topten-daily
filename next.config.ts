import type { NextConfig } from "next";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const onGitHub = process.env.GITHUB_ACTIONS === "true";
const isUserSite = repo.endsWith(".github.io");
const basePath = onGitHub && repo && !isUserSite ? `/${repo}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Vinext beta.5 prerenders route URLs without basePath. Keep the router
  // rooted at / and prefix only static assets for this single-page app.
  assetPrefix: basePath,
  images: { unoptimized: true },
};

export default nextConfig;
