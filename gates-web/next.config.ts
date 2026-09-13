import type { NextConfig } from 'next';

/** Server-side proxy target (not exposed to the browser). Defaults to loopback to avoid IPv6/localhost quirks. */
const backendOrigin = (process.env.BACKEND_PROXY_TARGET || 'http://127.0.0.1:3001').replace(/\/$/, '');

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.builder.io',
        pathname: '/api/v1/image/**',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['primereact', 'lucide-react', 'recharts'],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions ?? {}),
        ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
      };
    }
    return config;
  },
  // Output configuration
  output: 'standalone',
  /**
   * Dev-friendly proxy: browser calls same origin (`/api/v1`, `/health`) so requests are not cross-origin
   * (avoids CORS and several "Failed to fetch" cases). Set NEXT_PUBLIC_API_URL to skip and hit the API directly.
   */
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${backendOrigin}/api/v1/:path*` },
      { source: '/health/:path*', destination: `${backendOrigin}/health/:path*` },
      { source: '/health', destination: `${backendOrigin}/health` },
    ];
  },
  /** Sidebar / legacy URLs that don't match on-disk route folders */
  async redirects() {
    return [
      { source: '/inventory/creations/units', destination: '/inventory/creations/unit', permanent: false },
      { source: '/inventory/creations/locations', destination: '/inventory/creations/location', permanent: false },
      { source: '/inventory/creations/items', destination: '/inventory/guide/items', permanent: false },
      { source: '/inventory/creations/categories', destination: '/inventory/creations/item-groups', permanent: false },
      { source: '/inventory/creations/pricing-policies', destination: '/inventory/creations/price-lists', permanent: false },
      { source: '/inventory/creations/suppliers', destination: '/accounting/cards/supplier', permanent: false },
      { source: '/inventory/creations/customers', destination: '/accounting/cards/customer', permanent: false },
      { source: '/inventory/reports/item-movements', destination: '/inventory/reports/item-movement-reports', permanent: false },
      { source: '/inventory/reports/expiry', destination: '/inventory/reports/expiry-date-report', permanent: false },
      { source: '/inventory/reports/item-balances', destination: '/inventory/reports/inventory-reports', permanent: false },
      { source: '/inventory/reports/valuation', destination: '/inventory/reports/inventory-reports', permanent: false },
      { source: '/inventory/reports/reorder', destination: '/inventory/reports/items-exceeding-order-limit', permanent: false },
      { source: '/inventory/reports/slow-moving', destination: '/inventory/reports/item-movement-reports', permanent: false },
      { source: '/accounting-settings/create-users', destination: '/accounting-settings/create-user-groups', permanent: false },
      {
        source: '/accounting-settings/company-settings/income-statement-accounts',
        destination: '/accounting-settings/company-settings/income-statement-settings',
        permanent: false,
      },
      {
        source: '/accounting/account-reports/balances/cost-centers-balancee',
        destination: '/accounting/account-reports/balances/cost-center-balancee',
        permanent: false,
      },
      { source: '/hr/payroll-policies', destination: '/hr/wage-policy', permanent: false },
      { source: '/hr/employees', destination: '/hr/employee-data', permanent: false },
      { source: '/hr/admin-procedures', destination: '/hr/procedures', permanent: false },
      { source: '/hr/payroll', destination: '/hr/monthly-salaries', permanent: false },
      { source: '/hr/employee-files', destination: '/hr/employee-data', permanent: false },
      { source: '/hr/transactions', destination: '/hr/transaction-tracking', permanent: false },
    ];
  },
  // Headers for security and performance
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
