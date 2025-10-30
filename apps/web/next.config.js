/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@zzik/database', '@zzik/shared'],
  
  // Allow dev server to be accessed from sandbox URLs
  // Next.js 15.5+ requires explicit allowedDevOrigins for cross-origin requests
  allowedDevOrigins: [
    '*.sandbox.novita.ai',
    'localhost',
  ],
  
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.mapbox.com',
      },
    ],
  },
  // Suppress webpack warnings in development
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.infrastructureLogging = {
        level: 'error',
      };
      // Suppress HMR websocket errors in sandbox environments
      config.devServer = {
        ...config.devServer,
        client: {
          webSocketURL: 'auto://_next/webpack-hmr',
          overlay: false,
        },
      };
    }
    return config;
  },
  // Configure allowed dev origins for cross-origin requests
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
