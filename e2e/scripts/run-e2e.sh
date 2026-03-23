#!/bin/bash
set -e

# ─────────────────────────────────────────────────────
# GovMunicípio — E2E Test Runner
#
# Usage:
#   ./e2e/scripts/run-e2e.sh              # Auto-detect: Docker if available, else native Maestro
#   ./e2e/scripts/run-e2e.sh --docker     # Force Docker mode
#   ./e2e/scripts/run-e2e.sh --native     # Force native Maestro mode
# ─────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
E2E_DIR="$PROJECT_ROOT/e2e"

MODE="${1:-auto}"

echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  GovMunicípio — E2E Test Suite${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
echo ""

# ── Detect mode ─────────────────────────────────────
if [ "$MODE" = "auto" ]; then
  if command -v docker &> /dev/null && docker compose version &> /dev/null; then
    MODE="--docker"
    echo -e "${YELLOW}Auto-detected: Docker available → running in Docker mode${NC}"
  elif command -v maestro &> /dev/null; then
    MODE="--native"
    echo -e "${YELLOW}Auto-detected: Maestro CLI available → running in native mode${NC}"
  else
    echo -e "${RED}Error: Neither Docker nor Maestro CLI found.${NC}"
    echo ""
    echo -e "${YELLOW}Option 1 — Docker (recommended):${NC}"
    echo "  Install Docker Desktop: https://docs.docker.com/get-docker/"
    echo ""
    echo -e "${YELLOW}Option 2 — Native Maestro:${NC}"
    echo "  1. Install Java 17+: brew install openjdk@17"
    echo "  2. Install Maestro:  curl -fsSL 'https://get.maestro.mobile.dev' | bash"
    exit 1
  fi
fi
echo ""

# ── Docker mode ─────────────────────────────────────
if [ "$MODE" = "--docker" ]; then
  echo -e "${YELLOW}[Docker] Building and running E2E containers...${NC}"
  echo ""

  cd "$PROJECT_ROOT"

  # Ensure results directory exists for the volume mount
  mkdir -p "$E2E_DIR/results"

  TEST_EXIT=0
  docker compose -f e2e/docker-compose.e2e.yml up \
    --build \
    --exit-code-from maestro \
    --abort-on-container-exit \
    || TEST_EXIT=$?

  # Cleanup
  docker compose -f e2e/docker-compose.e2e.yml down --volumes --remove-orphans 2>/dev/null || true

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
  if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}  ✅  ALL E2E TESTS PASSED${NC}"
  else
    echo -e "${RED}  ❌  E2E TESTS FAILED (exit code: ${TEST_EXIT})${NC}"
  fi
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

  if [ -f "$E2E_DIR/results/report.xml" ]; then
    echo -e "  JUnit report: ${E2E_DIR}/results/report.xml"
  fi

  exit $TEST_EXIT
fi

# ── Native mode ─────────────────────────────────────
if [ "$MODE" = "--native" ]; then
  E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
  PORT=3000

  echo -e "${YELLOW}[Native] Running with local Maestro CLI...${NC}"
  echo -e "  Maestro: $(maestro --version 2>/dev/null || echo 'installed')"
  echo -e "  Target:  ${E2E_BASE_URL}"
  echo ""

  # Check if dev server is running, start if not
  DEV_SERVER_PID=""
  if ! curl -sf "${E2E_BASE_URL}" > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting Next.js dev server...${NC}"

    # Kill existing process on port
    if command -v lsof &> /dev/null && lsof -Pi :${PORT} -sTCP:LISTEN -t > /dev/null 2>&1; then
      lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true
      sleep 1
    fi

    cd "$PROJECT_ROOT/apps/web"
    npm run dev > /tmp/next-dev.log 2>&1 &
    DEV_SERVER_PID=$!

    echo -e "  PID: ${DEV_SERVER_PID}"
    echo -e "  Waiting for server..."

    TIMEOUT=120
    elapsed=0
    while [ $elapsed -lt $TIMEOUT ]; do
      if curl -sf "${E2E_BASE_URL}" > /dev/null 2>&1; then
        echo -e "${GREEN}  ✓ Server ready (${elapsed}s)${NC}"
        break
      fi
      sleep 2
      elapsed=$((elapsed + 2))
    done

    if [ $elapsed -ge $TIMEOUT ]; then
      echo -e "${RED}Error: Server did not start within ${TIMEOUT}s${NC}"
      tail -20 /tmp/next-dev.log 2>/dev/null
      kill $DEV_SERVER_PID 2>/dev/null || true
      exit 1
    fi
  else
    echo -e "${GREEN}  ✓ Server already running${NC}"
  fi

  # Run tests
  echo ""
  echo -e "${YELLOW}Running Maestro flows...${NC}"

  mkdir -p "$E2E_DIR/results"
  export E2E_BASE_URL

  TEST_EXIT=0
  maestro test "$E2E_DIR/flows/" \
    --format junit \
    --output "$E2E_DIR/results/report.xml" \
    || TEST_EXIT=$?

  # Cleanup
  if [ -n "$DEV_SERVER_PID" ]; then
    kill $DEV_SERVER_PID 2>/dev/null || true
    wait $DEV_SERVER_PID 2>/dev/null || true
  fi

  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"
  if [ $TEST_EXIT -eq 0 ]; then
    echo -e "${GREEN}  ✅  ALL E2E TESTS PASSED${NC}"
  else
    echo -e "${RED}  ❌  E2E TESTS FAILED (exit code: ${TEST_EXIT})${NC}"
  fi
  echo -e "${CYAN}══════════════════════════════════════════════════${NC}"

  exit $TEST_EXIT
fi

echo -e "${RED}Unknown mode: ${MODE}. Use --docker or --native${NC}"
exit 1
