# Changelog

## [1.3.0](https://github.com/opsrev/acculynx-cli/compare/v1.2.0...v1.3.0) (2026-03-29)


### Features

* add unofficial milestones command ([88845b8](https://github.com/opsrev/acculynx-cli/commit/88845b870617d77502de19a0d92c0695d03eca84))
* add unofficial milestones command to list and set job milestones ([fd52950](https://github.com/opsrev/acculynx-cli/commit/fd529503cf2eb020e02fc7de289d23f1379e5a3f))

## [1.2.0](https://github.com/opsrev/acculynx-cli/compare/v1.1.0...v1.2.0) (2026-03-28)


### Features

* add --notify flag to messages post for tagging users ([8b7aa0c](https://github.com/opsrev/acculynx-cli/commit/8b7aa0c2f36870dfb675747f253718ecacf20eab))
* add --type filter to messages list (server-side) ([5b6c586](https://github.com/opsrev/acculynx-cli/commit/5b6c586220ab33d359d6bef8ce60c1bad321e3c1))
* add unofficial job messages commands (list, post, notify) ([8e54002](https://github.com/opsrev/acculynx-cli/commit/8e54002e4bf8afe1a642d14f4c270ead51af6073))
* add unofficial messages list command for job message feed ([0439b45](https://github.com/opsrev/acculynx-cli/commit/0439b4509ae0b860edea8ddf62225140077d7950))
* add unofficial messages post command and POST support to client ([84edf77](https://github.com/opsrev/acculynx-cli/commit/84edf77a314eed45f71ed1cca93df7120fe0ac02))


### Bug Fixes

* simplify --type filter to single value (types are AND'd server-side) ([4b974e7](https://github.com/opsrev/acculynx-cli/commit/4b974e75a55cb390f06fb452ffc309c9bfeb053f))

## [1.1.0](https://github.com/opsrev/acculynx-cli/compare/v1.0.0...v1.1.0) (2026-03-20)


### Features

* add unofficial web API commands for job documents ([3712b86](https://github.com/opsrev/acculynx-cli/commit/3712b861029510ff8d45720b11607f091311bc0e))
* add unofficial web API commands for job documents ([80f8ac5](https://github.com/opsrev/acculynx-cli/commit/80f8ac533835fce1a584de8e22b98be07fc0598c))


### Bug Fixes

* add .env to gitignore to prevent credential leaks ([2bd5284](https://github.com/opsrev/acculynx-cli/commit/2bd528499649ea711a6391a6d52bd45c1f235570))
* add required sort params to contacts search with sensible defaults ([9664647](https://github.com/opsrev/acculynx-cli/commit/966464734c8c1e83ccbded911f6c72480199f270))
* add safe defaults for list pagination and search commands ([901d780](https://github.com/opsrev/acculynx-cli/commit/901d780e8ce2bb58506b5278b66c55d4d8797a86))
* add safe defaults for list pagination and search flags ([5334d47](https://github.com/opsrev/acculynx-cli/commit/5334d4731564ef30563b6ddc0b55d5f2b6cc6b0a))
* output help text as plain text instead of JSON ([d027d5a](https://github.com/opsrev/acculynx-cli/commit/d027d5a7d290b1c0a0d4eacee04380f39dc214c7))
* output help text as plain text instead of JSON-wrapped ([f5b4dc4](https://github.com/opsrev/acculynx-cli/commit/f5b4dc4010ea3274a35835e47ba532ca7d4ede3f))
* use correct SearchTerm field name in search API requests ([d6b962a](https://github.com/opsrev/acculynx-cli/commit/d6b962ac462702ccfb4627a199a85dd617d28d65))

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
