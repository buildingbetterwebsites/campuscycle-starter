import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
import { SITE_TSCONFIG, starterTests } from './scripts/lib/starterTests.mjs'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

const nextConfig: NextConfig = {
  // The build checks the types of every file, the tests too. In a site that is no longer the Campus
  // Cycle example, the starter's tests of the example are left out (scripts/lib/starterTests.mjs).
  ...(starterTests() === 'site' ? { typescript: { tsconfigPath: SITE_TSCONFIG } } : {}),
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
