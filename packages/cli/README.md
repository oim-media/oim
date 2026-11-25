# @oim-media/cli

Herramienta oficial de línea de comandos (`oim`) para inspeccionar, verificar, extraer, empaquetar y actualizar archivos `.oim.png`.

## Comandos

```bash
oim inspect <archivo>                  # Inspecciona capas, idiomas, fuentes y firma
oim verify <archivo> [--json]          # Valida esquema Zod y firma ECDSA P-256
oim extract <archivo> [-i png] [-m json] # Separa imagen base y metadatos
oim pack <imagen> -m <json> [-o out]   # Empaqueta (opcionalmente --sign --api-key ...)
oim upgrade <archivo> [-o out]         # Convierte archivo 1.x a formato 2.0 (sin firmar)
```

## Desarrollo

Desde la raíz del monorepo (`pnpm` exclusivamente):

```bash
pnpm --filter @oim-media/cli build
pnpm --filter @oim-media/cli test
pnpm --filter @oim-media/cli typecheck
```
