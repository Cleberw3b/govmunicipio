#!/bin/bash
set -e

# ─────────────────────────────────────────────────────
# Maestro E2E Docker Entrypoint
# Waits for the web app, then runs all test flows.
# Exit code 0 = all tests pass, non-zero = failure.
# ─────────────────────────────────────────────────────

WEB_URL="${E2E_BASE_URL:-http://web:3000}"
TIMEOUT="${E2E_TIMEOUT:-120}"
RESULTS_DIR="/e2e/results"

echo "══════════════════════════════════════════════════"
echo "  GovMunicípio — Maestro E2E Test Runner (Docker)"
echo "══════════════════════════════════════════════════"
echo ""
echo "  Web URL:  ${WEB_URL}"
echo "  Timeout:  ${TIMEOUT}s"
echo "  Flows:    /e2e/flows/"
echo ""

# ── Step 1: Verify Maestro ──────────────────────────
echo "[1/4] Checking Maestro..."
if ! command -v maestro &> /dev/null; then
  echo "ERROR: Maestro CLI not found in PATH"
  exit 1
fi
echo "  ✓ Maestro $(maestro --version 2>/dev/null || echo 'installed')"

# ── Step 2: Wait for web app ────────────────────────
echo "[2/4] Waiting for web app at ${WEB_URL}..."
elapsed=0
while [ $elapsed -lt $TIMEOUT ]; do
  if curl -sf "${WEB_URL}" > /dev/null 2>&1; then
    echo "  ✓ Web app is reachable (${elapsed}s)"
    break
  fi
  sleep 2
  elapsed=$((elapsed + 2))
  # Print a dot every 10 seconds
  if [ $((elapsed % 10)) -eq 0 ]; then
    echo "  ... still waiting (${elapsed}s)"
  fi
done

if [ $elapsed -ge $TIMEOUT ]; then
  echo "ERROR: Web app at ${WEB_URL} not reachable after ${TIMEOUT}s"
  exit 1
fi

# ── Step 3: Run Maestro flows ───────────────────────
echo "[3/4] Running Maestro test flows..."
echo ""

# Replace localhost URLs in flows with the actual web URL
# (flows use http://localhost:3000 but in Docker the service is at http://web:3000)
if [ "${WEB_URL}" != "http://localhost:3000" ]; then
  echo "  Patching flow URLs: localhost:3000 → ${WEB_URL#http://}..."
  find /e2e/flows -name '*.yaml' -exec \
    sed -i "s|http://localhost:3000|${WEB_URL}|g" {} +
fi

TEST_EXIT=0
maestro test /e2e/flows/ \
  --format junit \
  --output "${RESULTS_DIR}/report.xml" \
  || TEST_EXIT=$?

# ── Step 4: Report ──────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════"
if [ $TEST_EXIT -eq 0 ]; then
  echo "  ✅  ALL E2E TESTS PASSED"
else
  echo "  ❌  SOME E2E TESTS FAILED (exit code: ${TEST_EXIT})"
fi
echo "══════════════════════════════════════════════════"

# Copy results to a predictable location for CI artifact upload
if [ -f "${RESULTS_DIR}/report.xml" ]; then
  echo ""
  echo "  JUnit report: ${RESULTS_DIR}/report.xml"
fi

exit $TEST_EXIT
