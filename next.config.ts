import type { NextConfig } from "next";

const repo = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "";
const onGitHub = process.env.GITHUB_ACTIONS === "true";
const isUserSite = repo.endsWith(".github.io");
const basePath = onGitHub && repo && !isUserSite ? `/${repo}` : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
  images: { unoptimized: true },
};

export default nextConfig;
