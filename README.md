# OIM

Open format for interactive images: a PNG that carries signed, layered, animated
content and still opens as a plain image anywhere.

| Package | What it is |
|---|---|
| [`@oim-media/core`](packages/core) | Contract (Zod schema), binary reader, canonical form and the shared render rules |
| [`@oim-media/player-oim`](packages/player-oim) | `<oim-player>` web component for `.oim` images |
| [`@oim-media/player-ovm`](packages/player-ovm) | Web player for `.ovm` interactive video |
| [`packages/spec`](packages/spec) | Language-neutral spec: JSON Schema, binary layout and signed conformance vectors |

Nothing is published to npm yet.

## Develop

```bash
pnpm install
pnpm build
pnpm test
pnpm conformance   # the conformance vectors: the executable spec
```

pnpm only. `.npmrc` blocks install scripts and versions younger than 24 h.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
