# rigg

<p>
<a href="https://npmx.dev/package/create-rigg"><img src="https://npmx.dev/api/registry/badge/version/create-rigg" alt="Version"></a>
<a href="https://www.npmjs.com/package/create-rigg"><img src="https://img.shields.io/npm/v/create-rigg.svg" alt="Version"></a>
</p>

**The Unified Toolchain Starter for Node.js**

Creates a new Node.js TypeScript project using mostly the same toolchain as [Vite+](https://github.com/voidzero-dev/vite-plus), but for backend and non-web projects.

## Create a new project with rigg

```bash
pnpm create rigg@latest
npm create rigg@latest
```

## What you get

The project follows most of the same toolchain as Vite+.

| Tool                                               | Role               |
| -------------------------------------------------- | ------------------ |
| [Vitest](https://vitest.dev)                       | Testing            |
| [Oxlint](https://oxc.rs/docs/guide/usage/linter)   | Linting            |
| [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) | Formatting         |
| [tsx](https://tsx.is)                              | Dev-mode execution |
| [tsdown](https://tsdown.dev)                       | Build              |

### Backend framework

You can also choose one of the following backend frameworks:

- **Hono** — lightweight, modern API framework
- **Fastify** — fast and low overhead
- **Express** — familiar and widely supported
- **None** — where you don't need a API framework, or you want to pick your own.

## Scripts

Every generated project includes:

```bash
pnpm dev        # Run with tsx (no build step)
pnpm build      # Build with tsdown
pnpm test       # Run Vitest
pnpm check      # Lint + format check + type check
pnpm fmt        # Format
pnpm fmt:check  # Check formatting without writing
pnpm lint       # Lint
pnpm lint:fix   # Lint with auto-fix
```

You can also use `npm` or `yarn` or `bun`, depending on your package manager.

## License

MIT

## Author

- [Espen Steen](https://github.com/ehs5)
