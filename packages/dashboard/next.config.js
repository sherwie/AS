/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['pg', 'ioredis'],
  },
};

module.exports = nextConfig;
