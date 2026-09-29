/** @type {import('next').NextConfig} */
const nextConfig = {
  // Use standard Next.js page rendering (no static export so API routes work)
  reactStrictMode: true,
  output: 'standalone',

  // Path aliases are handled in tsconfig; Next.js reads them automatically
  // Images – allow any hostname (Supabase storage etc.)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  // Forward Supabase env vars to the browser exactly as they are named
  // (they are already NEXT_PUBLIC_ in Vercel config)
  env: {},

  // Silence ESLint during production builds (we run lint separately)
  eslint: { ignoreDuringBuilds: true },

  // TypeScript is checked with `npm run typecheck` before deployment.
  // No build-time type suppression — build fails on type errors.
};

export default nextConfig;
