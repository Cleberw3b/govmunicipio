# GovMunicípio E2E Testing with Maestro

End-to-end tests for the GovMunicípio web frontend using [Maestro](https://github.com/mobile-dev-inc/maestro), running inside Docker for reproducible, portable test execution.

---

## Quick Start

### Docker (recommended — no local dependencies needed)

```bash
# From the project root:
./e2e/scripts/run-e2e.sh

# Or explicitly:
./e2e/scripts/run-e2e.sh --docker
```

This builds two containers and orchestrates them via `docker-compose.e2e.yml`:

| Container | What it does |
|-----------|-------------|
| `web` | Builds the Next.js frontend (standalone production image) |
| `maestro` | Java 17 + Maestro CLI + Chromium — runs all test flows against `web` |

The **exit code from the `maestro` container** determines pass/fail. JUnit XML results are written to `e2e/results/report.xml`.

### Native (requires Java 17 + Maestro CLI installed locally)

```bash
./e2e/scripts/run-e2e.sh --native
```

The script auto-starts a Next.js dev server if one isn't running, runs all flows, then cleans up.

---

## How the Docker Build Works

```
┌─────────────────────────────────────────────────────────────────┐
│  docker compose -f e2e/docker-compose.e2e.yml up                │
│    --build --exit-code-from maestro --abort-on-container-exit   │
│                                                                 │
│  ┌───────────────┐       ┌────────────────────────────────┐    │
│  │  web           │       │  maestro                       │    │
│  │  (Dockerfile.  │       │  (Dockerfile.maestro)          │    │
│  │   web)         │       │                                │    │
│  │               │◄──────│  1. Waits for web:3000          │    │
│  │  Next.js      │ HTTP  │  2. Patches flow URLs           │    │
│  │  standalone   │       │  3. Runs maestro test flows/    │    │
│  │  :3000        │       │  4. Writes JUnit XML            │    │
│  └───────────────┘       │  5. Exits with 0 or non-zero   │    │
│                          └────────────────────────────────┘    │
│                                        │                       │
│                                        ▼                       │
│                              e2e/results/report.xml            │
│                              (volume-mounted to host)          │
└─────────────────────────────────────────────────────────────────┘
```

The `web` container uses a multi-stage build (`Dockerfile.web`): installs deps → builds shared package → builds Next.js standalone → runs `node server.js`.

The `maestro` container (`Dockerfile.maestro`) is based on `eclipse-temurin:17-jre-alpine` with Chromium for headless browser testing.

---

## CI Pipeline Integration

The GitHub Actions pipeline at `.github/workflows/ci.yml` runs E2E in Docker:

```yaml
e2e-maestro:
  runs-on: ubuntu-latest
  needs: lint-and-build
  steps:
    - uses: actions/checkout@v4

    - name: Run E2E tests (Docker)
      run: |
        docker compose -f e2e/docker-compose.e2e.yml up \
          --build \
          --exit-code-from maestro \
          --abort-on-container-exit

    - name: Upload Maestro test results
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: maestro-e2e-results
        path: e2e/results/
```

The `--exit-code-from maestro` flag makes the CI step fail if any Maestro test fails, blocking the merge.

---

## Test Flows

### Directory Layout

```
e2e/flows/
├── auth/                 Login, invalid creds, empty fields, set-password
├── dashboard/            Login page rendering, protected route redirects
├── tfd/                  TFD list and create page auth checks
├── admin/                Admin routes require super_admin auth
└── accessibility/        Skip link, keyboard nav, pt-BR language
```

### Coverage Summary

| Area | Flows | What they verify |
|------|-------|-----------------|
| auth | 4 | Login form rendering, validation, credential errors, set-password link |
| dashboard | 4 | Login page loads, protected routes redirect to /auth/login |
| tfd | 2 | TFD request pages require authentication |
| admin | 3 | Admin pages require authentication |
| accessibility | 3 | Skip-to-content link, keyboard Tab navigation, lang="pt-BR" |

---

## Adding New Tests

Create a `.yaml` file in the appropriate `flows/` subdirectory:

```yaml
appId: com.govmunicipio.web
---
- openLink: http://localhost:3000/auth/login
- assertVisible: GovMunicípio
- tapOn:
    id: username
- inputText: admin@test.com
- tapOn: Entrar
- waitForAnimationToEnd
- assertVisible: Dashboard
```

Common commands: `openLink`, `tapOn`, `inputText`, `pressKey`, `assertVisible`, `assertNotVisible`, `scroll`, `wait`, `waitForAnimationToEnd`, `back`.

The Docker entrypoint auto-patches `localhost:3000` URLs to the internal Docker network address, so flows work in both local and containerized environments.

---

## Running Specific Suites

```bash
# With native Maestro:
maestro test e2e/flows/auth/
maestro test e2e/flows/auth/login-success.yaml

# With Docker (runs all flows):
docker compose -f e2e/docker-compose.e2e.yml up --build --exit-code-from maestro
```

---

## Troubleshooting

**Docker build fails on Next.js fonts:** The app uses Google Fonts. If the build environment has no internet, the font fetch fails. The production Vercel deploy and GitHub Actions runners have internet access, so this only affects fully-offline builds.

**Maestro "element not found":** Check that text matches exactly (case-sensitive, Portuguese). Use `id:` selectors when text is ambiguous. Add `waitForAnimationToEnd` or `wait: { duration: 2 }` after navigation.

**Container healthcheck fails:** The `web` container needs 10-20 seconds to start. The healthcheck has `start_period: 10s` and retries 20 times at 5s intervals. If it still fails, increase the retry count in `docker-compose.e2e.yml`.
