# OIM

OIM is an open format for interactive images. An `.oim` file is a PNG that also
carries signed, layered and animated content in a metadata chunk. It still opens
as an ordinary image anywhere; OIM-aware players compose the layers, animations
and interactions on top of it.

## Packages

| Package | What it is |
|---|---|
| [`@oim-media/core`](packages/core) | Contract schema, binary reader, canonical form and the render rules shared by every player. |
| [`@oim-media/player-oim`](packages/player-oim) | `<oim-player>` web component for `.oim` images. |
| [`@oim-media/player-ovm`](packages/player-ovm) | Web player for `.ovm` interactive video. |
| [`@oim-media/spec`](packages/spec) | Language-neutral spec: JSON Schema, binary layout, conformance vectors and the public player keys. |

## Install

The packages are published to GitHub Packages under the `@oim-media` scope. Point
that scope at the GitHub registry in your project's `.npmrc`:

```ini
@oim-media:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

`NODE_AUTH_TOKEN` must hold a GitHub token with the `read:packages` scope. Then:

```bash
pnpm add @oim-media/player-oim
```

## Develop

This is a pnpm workspace; use pnpm only.

```bash
pnpm install
pnpm build
pnpm test          # core and player unit tests
pnpm typecheck
pnpm conformance   # the conformance vectors: the executable spec
pnpm test:tools    # release and packaging scripts
```

`pnpm conformance` must stay green for any change to the format, serialization or
rendering. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Versioning

Every package and the contract share one version, and a release tag names it.

- **Minor**: a new node type or field. Older readers ignore what they do not know.
- **Major**: only when an older `.oim` would render differently.
- **Patch**: fixes to how something is drawn, with no change to the format.

## License

Code is licensed under the [Apache License 2.0](LICENSE). The "OIM" name and the
"OIM compatible" mark are not licensed under Apache-2.0; see [NOTICE](NOTICE).

## Security

Report vulnerabilities privately to devs@oim.media, not in public issues. See
[SECURITY.md](SECURITY.md).
