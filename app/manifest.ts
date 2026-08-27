import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Policy Hub',
    short_name: 'Policy Hub',
    description: 'Practice policies, SOPs and governance documents',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#9333ea',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
