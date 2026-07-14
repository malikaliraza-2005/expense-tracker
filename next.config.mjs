/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Server Actions are enabled by default in Next 14; kept explicit for clarity.
    // The avatar validation limit is 2 MB (see AVATAR_MAX_BYTES and the avatars
    // bucket file_size_limit). This transport ceiling is set above that so a
    // near-2 MB upload plus multipart overhead reaches uploadAvatar and hits the
    // graceful "Image must be 2 MB or smaller" check, rather than being rejected
    // by Next before validation runs.
    serverActions: {
      bodySizeLimit: '3mb',
    },
  },
};

export default nextConfig;
