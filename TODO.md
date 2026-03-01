# TODO

## Security Hardening

- [x] **Upgrade better-sqlite3 to fix CVE-2025-6965** (HIGH)
  Current v11.10.0 bundles SQLite 3.49.2, vulnerable to memory corruption (CVSS 9.8). Upgrade to a version bundling SQLite >= 3.50.2.

- [x] **Add Zod validation for JSON deck imports** (LOW)
  `src/importers/JsonImporter.ts` parses JSON without runtime schema validation. Add a Zod schema to catch malformed deck files before they cause runtime errors. Zod is already a dependency.

- [x] **Set explicit directory permissions on `~/.realm-of-recall/`** (LOW)
  `src/data/database.ts` creates the data directory without explicit permissions. Add `{ mode: 0o700 }` to `mkdirSync` to prevent other users on shared systems from reading the game database.
