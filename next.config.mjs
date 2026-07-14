/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are enabled by default in Next 14; kept explicit for clarity.
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
