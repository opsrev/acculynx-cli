# Changelog

## 1.0.0 (2026-03-19)


### Features

* add API client with Bearer auth and 429 retry ([bbc8ca2](https://github.com/opsrev/acculynx-cli/commit/bbc8ca272937339378a0506571bde70414707ed8))
* add CLI entry point and ping command ([72ba129](https://github.com/opsrev/acculynx-cli/commit/72ba12969438e165161d6dffb5d44cf7c459f6ad))
* add config module with API key resolution ([c13843c](https://github.com/opsrev/acculynx-cli/commit/c13843cafc038a1e86b7bfcdc0aa0a4a52c07fa7))
* add contacts commands with list, get, create, search, emails, phones ([597942d](https://github.com/opsrev/acculynx-cli/commit/597942d0d33a52b4808c975b6e13e7fdbf0b8c00))
* add estimates commands with list, get, sections, items ([02dc404](https://github.com/opsrev/acculynx-cli/commit/02dc404a17a00c76c1d9f3623f85c84969cb8454))
* add jobs commands with list, get, create, search, sub-resources ([951db87](https://github.com/opsrev/acculynx-cli/commit/951db8772eba74a08a1aae1eeb3eb23fa057e450))
* add pagination and stdin reader helpers ([6804956](https://github.com/opsrev/acculynx-cli/commit/6804956f2a7ae4fc861d700cde4f0c66cf8d514a))


### Bug Fixes

* correct API paths and add integration test suite ([fa818f9](https://github.com/opsrev/acculynx-cli/commit/fa818f98ef2f387591b498651a422d6e3aee8033))
* correct ping path to /diagnostics/ping and page size to 25 ([79013d5](https://github.com/opsrev/acculynx-cli/commit/79013d51d110d804a90357fae4cce0da9971c883))
* remove unused --page-size and --start-index options from jobs list ([9134d95](https://github.com/opsrev/acculynx-cli/commit/9134d9556c7d3cd9621f8830a75c3f8badd2e623))
