# OIM

OIM is an open format for interactive images. An `.oim` file is a PNG that also
carries signed, layered and animated content in a metadata chunk. It still opens
as an ordinary image anywhere; OIM-aware players compose the layers, animations
and interactions on top of it.

## Packages

| Package | What it is |
|---|---|
| [`@oim-media/core`](packages/core/README.md) | Contract schema, binary reader, canonical form and the render rules shared by every player. |
| [`@oim-media/player-oim`](packages/player-oim/README.md) | `<oim-player>` web component for `.oim` images. |
| [`@oim-media/player-ovm`](packages/player-ovm/README.md) | Reserved placeholder for `.ovm` interactive video (pending specification). |
| [`@oim-media/spec`](packages/spec/README.md) | Language-neutral contract: JSON Schema, binary and canonical specifications, conformance vectors and the public player keys. |

## Install

The packages are published to GitHub Packages under the `@oim-media` scope. Point
that scope at the GitHub registry in your project's `.npmrc`:

```ini
@oim-media:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

`NODE_AUTH_TOKEN` must hold a GitHub token with the `read:packages` scope. The
token is required even though the packages are public: the GitHub registry does not
serve `@oim-media` anonymously. Then:

```bash
pnpm add @oim-media/player-oim
```

Start with [`@oim-media/player-oim`](packages/player-oim/README.md) to embed a file in
a page, or [`@oim-media/core`](packages/core/README.md) to read or write metadata.

## Develop

This is a pnpm workspace; use pnpm only.

```bash
pnpm install
pnpm build         # core, player-oim and player-ovm
pnpm test          # unit tests of core and player-oim
pnpm typecheck     # the typecheck scripts of core and player-oim
pnpm conformance   # the conformance vectors in packages/spec/vectors
pnpm test:tools    # the release and packaging scripts in tools/
pnpm check:licenses
```

`pnpm conformance` must stay green for any change to the format, serialization or
rendering. The vectors are described in [`packages/spec`](packages/spec/README.md).
To check a release before tagging, run `node tools/versions.mjs vX.Y.Z` and
`node tools/pack-contents.mjs` after `pnpm build`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.

## Versioning

The four packages are released together under one version, and a release tag
(`vX.Y.Z`) names it. That version must equal the format version, `CONTRACT_VERSION`
in `packages/core/src/compatibility.ts`. See the [spec](packages/spec/README.md#versioning).

- **Minor**: a new node type or field. Older readers ignore what they do not know.
- **Major**: only when an older `.oim` would render differently.
- **Patch**: fixes to how something is drawn, with no change to the format.

## License

Code is licensed under the [Apache License 2.0](LICENSE). The "OIM" name and the
"OIM compatible" mark are not licensed under Apache-2.0; see [NOTICE](NOTICE).

## Security

Report vulnerabilities privately to devs@oim.media, not in public issues. See
[SECURITY.md](SECURITY.md).
