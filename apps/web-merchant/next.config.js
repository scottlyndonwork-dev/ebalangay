/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.ebalangay.ph',
      },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
}

export default nextConfig
