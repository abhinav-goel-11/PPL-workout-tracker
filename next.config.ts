import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // A stray package.json sits in the parent folder; pin the root so Turbopack
  // doesn't walk up and treat it as the workspace.
  turbopack: { root: __dirname },
};

export default nextConfig;
