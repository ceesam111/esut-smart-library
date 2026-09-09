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

  // TypeScript is checked with `npx tsc --noEmit` before deployment. Skipping
  // Next's duplicate build-time type pass keeps Coolify image builds under its timeout.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
