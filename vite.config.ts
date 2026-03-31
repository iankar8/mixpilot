import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Serve ~/Music/dj-library at /library
    {
      name: 'serve-dj-library',
      configureServer(server) {
        const libraryRoot = path.resolve(
          process.env.HOME || '/Users/iankar',
          'Music/dj-library',
        )
        server.middlewares.use('/library', (req, res, next) => {
          const decodedPath = decodeURIComponent(req.url || '/')
          const filePath = path.join(libraryRoot, decodedPath)

          try {
            const stats = fs.statSync(filePath)
            if (!stats.isFile()) {
              next()
              return
            }

            // Set content type for mp3
            if (filePath.endsWith('.mp3')) {
              res.setHeader('Content-Type', 'audio/mpeg')
            }
            res.setHeader('Accept-Ranges', 'bytes')

            // Handle range requests for audio seeking
            const range = req.headers.range
            if (range) {
              const parts = range.replace(/bytes=/, '').split('-')
              const start = parseInt(parts[0], 10)
              const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1
              const chunkSize = end - start + 1

              res.writeHead(206, {
                'Content-Range': `bytes ${start}-${end}/${stats.size}`,
                'Content-Length': chunkSize,
                'Content-Type': 'audio/mpeg',
                'Accept-Ranges': 'bytes',
              })
              fs.createReadStream(filePath, { start, end }).pipe(res)
            } else {
              res.setHeader('Content-Length', stats.size)
              res.writeHead(200)
              fs.createReadStream(filePath).pipe(res)
            }
          } catch {
            next()
          }
        })
      },
    },
  ],
  server: {
    fs: {
      allow: ['.', '/Users/iankar/Music/dj-library'],
    },
  },
})
