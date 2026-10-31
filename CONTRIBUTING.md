# Contributing

- pnpm only; Node 24.
- Every change to the format, serialization or rendering must keep `pnpm conformance` green.
  A format change without a new or updated vector in `packages/spec/vectors` will not be merged.
- Conventional commits with a scope: `feat(player):`, `fix(core):`.
- New files carry the Apache-2.0 header used across `packages/`.
