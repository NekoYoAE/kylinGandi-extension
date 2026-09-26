import { defineConfig } from 'tsup'

export default defineConfig({
  name: 'kylin',
  entry: ['src/index.ts'],
  target: ['esnext'],
  format: ['iife'],
  outDir: 'dist',
  banner: {
    js: `// Name: Kylin (Gandi)
// ID: kylin
// Description: Obfuscate and precompile your Gandi IDE project.
// By: FurryR, ported to Gandi IDE
// License: AGPL-3.0-only
`
  },
  platform: 'browser',
  clean: true,
  define: {
    'process.env.NODE_ENV': '"production"'
  }
})
