/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Consume the workspace TS/CJS packages without prebuilding them.
  transpilePackages: ["@orbit/shared", "@orbit/connector-sdk"],
};

export default nextConfig;
