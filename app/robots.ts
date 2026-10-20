import type { MetadataRoute } from 'next';
import { appBaseUrl } from '@/server/seo/scholarlyMetadata';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/dashboard',
          '/supervisor',
          '/reset-password',
          '/repository/submit',
          '/thesis/submit',
          '/thesis/status',
          '/search/global?',
          '/catalogue?',
          '/catalog?',
          '/categories?',
          '/databases?',
          '/repository?',
          '/theses?',
          '/catalog/?*sort=',
          '/catalogue/?*sort=',
          '/repository/?*sort=',
          '/catalog/?*page=',
          '/catalogue/?*page=',
          '/repository/?*page=',
        ],
      },
    ],
    sitemap: `${appBaseUrl()}/sitemap.xml`,
  };
}
