export type Framework = "none" | "hono" | "fastify" | "express";
export type FrameworkDependencies = { deps: string[]; devDeps: string[] };

export const FRAMEWORKS: { value: Framework; label: string; hint?: string }[] = [
  { value: "none", label: "None" },
  { value: "hono", label: "Hono", hint: "recommended" },
  { value: "fastify", label: "Fastify" },
  { value: "express", label: "Express" },
];

export const FRAMEWORK_DEPS: Record<Framework, FrameworkDependencies> = {
  none: { deps: [], devDeps: [] },
  hono: { deps: ["hono", "@hono/node-server"], devDeps: [] },
  fastify: { deps: ["fastify"], devDeps: [] },
  express: { deps: ["express"], devDeps: ["@types/express"] },
};

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

const fastify = Fastify({ logger: true })

fastify.get('/', async () => ({ hello: 'world' }))

fastify.listen({ port: 3000 })
`,
  express: `import express from 'express'

const app = express()

app.get('/', (req, res) => {
  res.send('Hello World')
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
`,
};
