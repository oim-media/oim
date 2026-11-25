# @oim-media/cli

Official command-line tool (`oim`) to inspect, verify, extract, pack, and upgrade `.oim.png` files.

## Commands

```bash
oim inspect <file>                       # Inspects layers, languages, fonts, and signature
oim verify <file> [--json]               # Validates schema (Zod) and ECDSA P-256 signature
oim extract <file> [-i png] [-m json]    # Separates the base PNG image and metadata JSON
oim pack <image> -m <json> [-o out]      # Packages PNG + metadata (optionally --sign --api-key ...)
oim upgrade <file> [-o out]              # Upgrades a 1.x file to Format 2.0 (unsigned)
```

## Development

From the repository root (`pnpm` only):

```bash
pnpm --filter @oim-media/cli build
pnpm --filter @oim-media/cli test
pnpm --filter @oim-media/cli typecheck
```
