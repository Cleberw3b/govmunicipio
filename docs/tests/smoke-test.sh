#!/usr/bin/env bash
# govmunicipio API — smoke tests
# Usage: ./smoke-test.sh [prod|staging]
# prod    → https://api-production-eb2b7.up.railway.app/api/v1  (default)
# staging → http://localhost:3001/api/v1

set -uo pipefail

# Load credentials from .env in the same directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/.env" ]]; then
  # shellcheck source=/dev/null
  set -a; source "$SCRIPT_DIR/.env"; set +a
fi

# Require credentials
: "${SUPERADMIN_USERNAME:?Missing SUPERADMIN_USERNAME in docs/tests/.env}"
: "${SUPERADMIN_PASSWORD:?Missing SUPERADMIN_PASSWORD in docs/tests/.env}"

ENV="${1:-prod}"
if [[ "$ENV" == "staging" ]]; then
  BASE="http://localhost:3001/api/v1"
else
  BASE="https://api-production-eb2b7.up.railway.app/api/v1"
fi

PASS=0
FAIL=0
TMPFILE=$(mktemp)

# ── helpers ────────────────────────────────────────────────────────────────────

green() { printf "\033[32m✔ %s\033[0m\n" "$*"; }
red()   { printf "\033[31m✘ %s\033[0m\n" "$*"; }

assert_status() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    green "$label (HTTP $actual)"
    ((PASS++)) || true
  else
    red "$label — expected HTTP $expected, got HTTP $actual  [body: $(cat "$TMPFILE" | head -c 200)]"
    ((FAIL++)) || true
  fi
}

assert_field() {
  local label="$1" field="$2" json="$3"
  if echo "$json" | grep -q "\"$field\""; then
    green "$label (field '$field' present)"
    ((PASS++)) || true
  else
    red "$label — field '$field' missing in response"
    ((FAIL++)) || true
  fi
}

# Runs curl, writes body to TMPFILE, returns status code
do_curl() {
  curl -s -w "%{http_code}" -o "$TMPFILE" "$@"
}

# ── 1. Connectivity ────────────────────────────────────────────────────────────

echo ""
echo "── Connectivity ──────────────────────────────────────────────────────────"
STATUS=$(do_curl -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{}')
if [[ "$STATUS" == "400" || "$STATUS" == "401" || "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  green "API is reachable (HTTP $STATUS)"
  ((PASS++)) || true
else
  red "API unreachable — HTTP $STATUS"
  ((FAIL++)) || true
fi

# ── 2. Auth ───────────────────────────────────────────────────────────────────

echo ""
echo "── Auth ──────────────────────────────────────────────────────────────────"

STATUS=$(do_curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SUPERADMIN_USERNAME\",\"password\":\"$SUPERADMIN_PASSWORD\"}")
BODY=$(cat "$TMPFILE")
# accept both 200 and 201
if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  green "POST /auth/login (superadmin) (HTTP $STATUS)"
  ((PASS++)) || true
else
  red "POST /auth/login (superadmin) — expected 200/201, got HTTP $STATUS"
  ((FAIL++)) || true
fi
assert_field "  → has accessToken" "accessToken" "$BODY"
SUPER_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# Bad credentials → 401
STATUS=$(do_curl -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SUPERADMIN_USERNAME\",\"password\":\"wrongpass\"}")
assert_status "POST /auth/login (bad creds → 401)" 401 "$STATUS"

# Unauthenticated → 401
STATUS=$(do_curl "$BASE/admin/hospitals")
assert_status "GET /admin/hospitals (no token → 401)" 401 "$STATUS"

# ── 3. Superadmin — Hospitals ─────────────────────────────────────────────────

echo ""
echo "── Admin / Hospitals ────────────────────────────────────────────────────"

STATUS=$(do_curl "$BASE/admin/hospitals" -H "Authorization: Bearer $SUPER_TOKEN")
assert_status "GET /admin/hospitals" 200 "$STATUS"

UNIQUE_CNES="SMK$(date +%H%M%S)"
TS=$(date +%H%M)
UNIQUE_CNPJ="12.${TS:0:3}.${TS:1:3}/0001-99"
STATUS=$(do_curl -X POST "$BASE/admin/hospitals" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"cnesCode\":\"$UNIQUE_CNES\",\"cnpj\":\"$UNIQUE_CNPJ\",\"name\":\"Smoke Test Hospital\"}")
BODY=$(cat "$TMPFILE")
# 500 = bug not yet deployed (street null constraint); 409 = conflict; 201 = OK
if [[ "$STATUS" == "500" ]]; then
  red "POST /admin/hospitals — HTTP 500 (pending fix deployment)"
  ((FAIL++)) || true
else
  assert_status "POST /admin/hospitals" 201 "$STATUS"
fi
assert_field  "  → has id" "id" "$BODY"
HOSPITAL_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [[ -n "$HOSPITAL_ID" ]]; then
  STATUS=$(do_curl -X PATCH "$BASE/admin/hospitals/$HOSPITAL_ID" \
    -H "Authorization: Bearer $SUPER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Smoke Test Hospital (updated)"}')
  assert_status "PATCH /admin/hospitals/:id" 200 "$STATUS"
fi

# ── 4. Superadmin — Specialties ───────────────────────────────────────────────

echo ""
echo "── Admin / Specialties ──────────────────────────────────────────────────"

STATUS=$(do_curl "$BASE/admin/specialties" -H "Authorization: Bearer $SUPER_TOKEN")
assert_status "GET /admin/specialties" 200 "$STATUS"

UNIQUE_CODE="99.$(date +%H).$(date +%M).$(date +%S)0-0"
STATUS=$(do_curl -X POST "$BASE/admin/specialties" \
  -H "Authorization: Bearer $SUPER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke Test Specialty\",\"code\":\"$UNIQUE_CODE\"}")
BODY=$(cat "$TMPFILE")
assert_status "POST /admin/specialties" 201 "$STATUS"
SPECIALTY_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

if [[ -n "$SPECIALTY_ID" ]]; then
  STATUS=$(do_curl -X PATCH "$BASE/admin/specialties/$SPECIALTY_ID" \
    -H "Authorization: Bearer $SUPER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"Smoke Test Specialty (updated)"}')
  assert_status "PATCH /admin/specialties/:id" 200 "$STATUS"
fi

# ── 5. Superadmin — Municipalities ────────────────────────────────────────────

echo ""
echo "── Admin / Municipalities ───────────────────────────────────────────────"

STATUS=$(do_curl "$BASE/admin/municipalities" -H "Authorization: Bearer $SUPER_TOKEN")
assert_status "GET /admin/municipalities" 200 "$STATUS"

# ── 6. TFD — list (superadmin → 404 "no municipality in token") ──────────────

echo ""
echo "── TFD ──────────────────────────────────────────────────────────────────"

STATUS=$(do_curl "$BASE/tfd/requests" -H "Authorization: Bearer $SUPER_TOKEN")
# superadmin has no organizationId in JWT
# Expected: 404 after fix deployed, 500 before fix (string_to_uuid bug)
if [[ "$STATUS" == "404" || "$STATUS" == "403" ]]; then
  green "GET /tfd/requests (superadmin → $STATUS, role-restricted as expected)"
  ((PASS++)) || true
elif [[ "$STATUS" == "200" ]]; then
  assert_status "GET /tfd/requests" 200 "$STATUS"
elif [[ "$STATUS" == "500" ]]; then
  red "GET /tfd/requests — HTTP 500 (KNOWN BUG: pending deploy of organizationId guard fix)"
  ((FAIL++)) || true
else
  red "GET /tfd/requests — unexpected HTTP $STATUS"
  ((FAIL++)) || true
fi

# ── 7. TFD — Lifecycle Status Transitions (requires ADMIN_USERNAME/PASSWORD) ──

echo ""
echo "── TFD / Lifecycle ────────────────────────────────────────────────────"

if [[ -n "${ADMIN_USERNAME:-}" && -n "${ADMIN_PASSWORD:-}" ]]; then
  # Login as municipality admin
  STATUS=$(do_curl -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")
  BODY=$(cat "$TMPFILE")
  ADMIN_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

  if [[ -n "$ADMIN_TOKEN" ]]; then
    green "Logged in as $ADMIN_USERNAME"
    ((PASS++)) || true

    # Find a patient person ID
    STATUS=$(do_curl "$BASE/persons/search?cpf=222.222.222-22" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    PERSON_BODY=$(cat "$TMPFILE")
    PATIENT_ID=$(echo "$PERSON_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [[ -n "$PATIENT_ID" ]]; then
      # Create TFD → expect draft
      STATUS=$(do_curl -X POST "$BASE/tfd/requests" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"patientPersonId\":\"$PATIENT_ID\"}")
      TFD_BODY=$(cat "$TMPFILE")
      assert_status "POST /tfd/requests (create draft)" 201 "$STATUS"
      TFD_ID=$(echo "$TFD_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

      # Try invalid transition: draft → in_transit (expect 400)
      STATUS=$(do_curl -X PATCH "$BASE/tfd/requests/$TFD_ID/status" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"statusCode":"in_transit"}')
      assert_status "PATCH status draft→in_transit (invalid → 400)" 400 "$STATUS"

      # Cancel draft → cancelled
      STATUS=$(do_curl -X PATCH "$BASE/tfd/requests/$TFD_ID/status" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"statusCode":"cancelled"}')
      assert_status "PATCH status draft→cancelled (valid)" 200 "$STATUS"

      # Try to change cancelled → pending (terminal, expect 400)
      STATUS=$(do_curl -X PATCH "$BASE/tfd/requests/$TFD_ID/status" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"statusCode":"pending"}')
      assert_status "PATCH status cancelled→pending (invalid → 400)" 400 "$STATUS"

      # Get statuses endpoint
      STATUS=$(do_curl "$BASE/tfd/requests/statuses" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
      assert_status "GET /tfd/requests/statuses" 200 "$STATUS"
    else
      red "Could not find patient for lifecycle test — skipping"
      ((FAIL++)) || true
    fi
  else
    red "Login as municipality admin failed — skipping lifecycle tests"
    ((FAIL++)) || true
  fi
else
  echo "  (skipped — ADMIN_USERNAME / ADMIN_PASSWORD not set in .env)"
fi

# ── 8. Permission tests (viewer cannot update status) ────────────────────────

echo ""
echo "── TFD / Permissions ──────────────────────────────────────────────────"

if [[ -n "${VIEWER_USERNAME:-}" && -n "${VIEWER_PASSWORD:-}" ]]; then
  STATUS=$(do_curl -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$VIEWER_USERNAME\",\"password\":\"$VIEWER_PASSWORD\"}")
  BODY=$(cat "$TMPFILE")
  VIEWER_TOKEN=$(echo "$BODY" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

  if [[ -n "$VIEWER_TOKEN" ]]; then
    # Viewer → cannot update status (expect 403)
    STATUS=$(do_curl -X PATCH "$BASE/tfd/requests/00000000-0000-0000-0000-000000000001/status" \
      -H "Authorization: Bearer $VIEWER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"statusCode":"cancelled"}')
    assert_status "PATCH status as viewer (→ 403)" 403 "$STATUS"
  fi
else
  echo "  (skipped — VIEWER_USERNAME / VIEWER_PASSWORD not set in .env)"
fi

# Unauthenticated → cannot update status (expect 401)
STATUS=$(do_curl -X PATCH "$BASE/tfd/requests/00000000-0000-0000-0000-000000000001/status" \
  -H "Content-Type: application/json" \
  -d '{"statusCode":"cancelled"}')
assert_status "PATCH status unauthenticated (→ 401)" 401 "$STATUS"

# ── Cleanup ───────────────────────────────────────────────────────────────────

rm -f "$TMPFILE"

# ── Summary ───────────────────────────────────────────────────────────────────

echo ""
echo "══════════════════════════════════════════════════════════════════════════"
printf "  Results: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m  (env: %s)\n" "$PASS" "$FAIL" "$ENV"
echo "══════════════════════════════════════════════════════════════════════════"
echo ""

[[ $FAIL -eq 0 ]]
