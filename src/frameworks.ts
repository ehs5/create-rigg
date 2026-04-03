export type Framework = "none" | "hono" | "fastify" | "express"
export type FrameworkDependencies = { deps: string[]; devDeps: string[] }

export const FRAMEWORKS: { value: Framework; label: string; hint?: string }[] = [
  { value: "none", label: "None" },
  { value: "hono", label: "Hono", hint: "recommended framework" },
  { value: "fastify", label: "Fastify" },
  { value: "express", label: "Express" },
]

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  none: "None",
  hono: "Hono",
  fastify: "Fastify",
  express: "Express",
}

export const FRAMEWORK_DEPS: Record<Framework, FrameworkDependencies> = {
  none: { deps: [], devDeps: [] },
  hono: { deps: ["hono", "@hono/node-server"], devDeps: [] },
  fastify: { deps: ["fastify"], devDeps: [] },
  express: { deps: ["express"], devDeps: ["@types/express"] },
}

/** Starter code (index.ts) for each framework. */
export const FRAMEWORK_INDEX: Record<Framework, string> = {
  none: `console.log('Hello from rigg!')\n`,
  hono: `import { Hono } from 'hono'
import { serve } from '@hono/node-server'

const app = new Hono()

app.get('/', (c) => c.text('Hello World'))

serve(app, (info) => {
  console.log(\`Server running on http://localhost:\${info.port}\`)
})
`,
  fastify: `import Fastify from 'fastify'

const fastify = Fastify({
  logger: true,
})

fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
`,
  express: `import express from 'express'

const app = express()
const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(port, () => {
  console.log(\`Server running on http://localhost:\${port}\`)
})
`,
}
