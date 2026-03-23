#!/usr/bin/env bash
# =============================================================================
# E2E Test: Create Patient → Create Doctor → Create TFD Request → Full Lifecycle
# =============================================================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001/api/v1}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-admin123}"
SUPERADMIN_USER="${SUPERADMIN_USER:-superadmin}"
SUPERADMIN_PASS="${SUPERADMIN_PASS:-superadmin123}"

PASSED=0
FAILED=0
TOTAL=0

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
red()    { printf "\033[31m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
bold()   { printf "\033[1m%s\033[0m\n" "$*"; }

assert_status() {
  local label="$1" expected="$2" actual="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$actual" = "$expected" ]; then
    green "  ✓ $label (HTTP $actual)"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $label — expected $expected, got $actual"
    FAILED=$((FAILED + 1))
  fi
}

assert_json_field() {
  local label="$1" json="$2" field="$3" expected="$4"
  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; print(json.load(sys.stdin)$field)" 2>/dev/null || echo "__MISSING__")
  if [ "$actual" = "$expected" ]; then
    green "  ✓ $label ($field = $actual)"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $label — $field: expected '$expected', got '$actual'"
    FAILED=$((FAILED + 1))
  fi
}

assert_json_not_empty() {
  local label="$1" json="$2" field="$3"
  TOTAL=$((TOTAL + 1))
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; v=json.load(sys.stdin)$field; print(v if v else '')" 2>/dev/null || echo "")
  if [ -n "$actual" ] && [ "$actual" != "None" ]; then
    green "  ✓ $label ($field = $actual)"
    PASSED=$((PASSED + 1))
  else
    red "  ✗ $label — $field is empty or missing"
    FAILED=$((FAILED + 1))
  fi
}

# Generate unique CPFs for test isolation
TIMESTAMP=$(date +%s)
PATIENT_CPF="111.${TIMESTAMP: -3:3}.${TIMESTAMP: -6:3}-00"
DOCTOR_CPF="222.${TIMESTAMP: -3:3}.${TIMESTAMP: -6:3}-00"

# ============================================================================
bold "═══════════════════════════════════════════════════════════════"
bold "  E2E Test: Patient → Doctor → TFD Request Full Lifecycle"
bold "═══════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# STEP 1: Login as admin (municipality user)
# ============================================================================
bold "▸ Step 1: Login as admin_municipality user"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Admin login" "201" "$HTTP_CODE"

ADMIN_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")
assert_json_not_empty "Token received" "$BODY" "['accessToken']"

if [ -z "$ADMIN_TOKEN" ]; then
  red "FATAL: Cannot proceed without admin token"
  exit 1
fi

echo ""

# ============================================================================
# STEP 2: Login as superadmin (for hospital/specialty operations)
# ============================================================================
bold "▸ Step 2: Login as super_admin user"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$SUPERADMIN_USER\",\"password\":\"$SUPERADMIN_PASS\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Superadmin login" "201" "$HTTP_CODE"

SUPERADMIN_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null || echo "")
assert_json_not_empty "Token received" "$BODY" "['accessToken']"

if [ -z "$SUPERADMIN_TOKEN" ]; then
  red "FATAL: Cannot proceed without superadmin token"
  exit 1
fi

echo ""

# ============================================================================
# STEP 3: Create a patient (Person)
# ============================================================================
bold "▸ Step 3: Create a Patient"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/persons" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"firstName\": \"Maria\",
    \"lastName\": \"Silva Test\",
    \"gender\": \"female\",
    \"cpf\": \"$PATIENT_CPF\",
    \"dateOfBirth\": \"1985-03-15\",
    \"susCardNumber\": \"SUS${TIMESTAMP}\",
    \"address\": {
      \"street\": \"Rua das Flores\",
      \"number\": \"123\",
      \"neighborhood\": \"Centro\",
      \"city\": \"Ilhéus\",
      \"state\": \"BA\",
      \"zipCode\": \"45650-000\"
    },
    \"contacts\": [
      { \"type\": \"phone\", \"value\": \"(73) 99999-0001\", \"label\": \"Celular\", \"isPrimary\": true }
    ]
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Create patient" "201" "$HTTP_CODE"
assert_json_field "Patient first name" "$BODY" "['firstName']" "Maria"
assert_json_field "Patient last name" "$BODY" "['lastName']" "Silva Test"
assert_json_field "Patient gender" "$BODY" "['gender']" "female"

PATIENT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
assert_json_not_empty "Patient ID assigned" "$BODY" "['id']"

yellow "    → Patient ID: $PATIENT_ID"
echo ""

# ============================================================================
# STEP 4: Verify patient can be fetched
# ============================================================================
bold "▸ Step 4: Verify Patient retrieval"

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/persons/$PATIENT_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Get patient by ID" "200" "$HTTP_CODE"
assert_json_field "Patient name matches" "$BODY" "['firstName']" "Maria"

echo ""

# ============================================================================
# STEP 5: Get a specialty for the doctor
# ============================================================================
bold "▸ Step 5: Get available specialty"

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/specialties?limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "List specialties" "200" "$HTTP_CODE"

SPECIALTY_ID=$(echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data.get('data', data) if isinstance(data, dict) else data
print(items[0]['id'] if items else '')
" 2>/dev/null || echo "")

if [ -z "$SPECIALTY_ID" ]; then
  yellow "    ⚠ No specialties found, skipping specialty link"
else
  yellow "    → Specialty ID: $SPECIALTY_ID"
fi

echo ""

# ============================================================================
# STEP 6: Create a doctor
# ============================================================================
bold "▸ Step 6: Create a Doctor"

DOCTOR_PAYLOAD="{\"firstName\": \"Carlos\", \"lastName\": \"Medeiro Test\", \"gender\": \"male\", \"cpf\": \"$DOCTOR_CPF\", \"dateOfBirth\": \"1975-08-20\", \"crm\": \"CRM-BA-${TIMESTAMP}\""

if [ -n "$SPECIALTY_ID" ]; then
  DOCTOR_PAYLOAD="$DOCTOR_PAYLOAD, \"specialtyIds\": [\"$SPECIALTY_ID\"]"
fi

DOCTOR_PAYLOAD="$DOCTOR_PAYLOAD}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/doctors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "$DOCTOR_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Create doctor" "201" "$HTTP_CODE"

DOCTOR_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
assert_json_not_empty "Doctor ID assigned" "$BODY" "['id']"
assert_json_field "Doctor CRM" "$BODY" "['crm']" "CRM-BA-${TIMESTAMP}"

yellow "    → Doctor ID: $DOCTOR_ID"
echo ""

# ============================================================================
# STEP 7: Get a hospital linked to the municipality
# ============================================================================
bold "▸ Step 7: Get available hospital"

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/hospitals?limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "List hospitals" "200" "$HTTP_CODE"

HOSPITAL_ID=$(echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
items = data.get('data', data) if isinstance(data, dict) else data
print(items[0]['id'] if items else '')
" 2>/dev/null || echo "")

if [ -n "$HOSPITAL_ID" ]; then
  yellow "    → Hospital ID: $HOSPITAL_ID"
else
  yellow "    ⚠ No hospital found (TFD will be created without one)"
fi

echo ""

# ============================================================================
# STEP 8: Create TFD Request (draft)
# ============================================================================
bold "▸ Step 8: Create TFD Request (draft)"

TFD_PAYLOAD="{\"patientPersonId\": \"$PATIENT_ID\""

[ -n "$DOCTOR_ID" ]   && TFD_PAYLOAD="$TFD_PAYLOAD, \"requestingDoctorId\": \"$DOCTOR_ID\""
[ -n "$HOSPITAL_ID" ] && TFD_PAYLOAD="$TFD_PAYLOAD, \"destinationHospitalId\": \"$HOSPITAL_ID\""

TFD_PAYLOAD="$TFD_PAYLOAD}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/tfd/requests" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "$TFD_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Create TFD request" "201" "$HTTP_CODE"

TFD_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
PROTOCOL=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['protocolNumber'])" 2>/dev/null || echo "")
STATUS_CODE=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['status']['code'])" 2>/dev/null || echo "")

assert_json_not_empty "TFD ID assigned" "$BODY" "['id']"
assert_json_not_empty "Protocol number generated" "$BODY" "['protocolNumber']"
assert_json_field "Initial status is draft" "$BODY" "['status']['code']" "draft"

yellow "    → TFD ID: $TFD_ID"
yellow "    → Protocol: $PROTOCOL"
echo ""

# ============================================================================
# STEP 9: Update TFD with clinical data
# ============================================================================
bold "▸ Step 9: Update TFD with clinical and travel data"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/tfd/requests/$TFD_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"diagnosisCid\": \"J06.9\",
    \"procedureDescription\": \"Consulta com especialista em cardiologia\",
    \"justification\": \"Paciente necessita avaliação cardíaca especializada não disponível no município\",
    \"requestDate\": \"2026-03-23\",
    \"travelDate\": \"2026-04-01\",
    \"returnDate\": \"2026-04-02\",
    \"transportType\": \"bus\",
    \"notes\": \"Paciente acompanhado por familiar\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Update TFD clinical data" "200" "$HTTP_CODE"
assert_json_field "Diagnosis CID saved" "$BODY" "['diagnosisCid']" "J06.9"
assert_json_field "Transport type saved" "$BODY" "['transportType']" "bus"

echo ""

# ============================================================================
# STEP 10: Fetch TFD and verify all relations
# ============================================================================
bold "▸ Step 10: Verify TFD with all relations"

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/tfd/requests/$TFD_ID" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Get TFD by ID" "200" "$HTTP_CODE"
assert_json_field "Patient linked" "$BODY" "['patientPerson']['firstName']" "Maria"
assert_json_field "Doctor linked" "$BODY" "['requestingDoctor']['crm']" "CRM-BA-${TIMESTAMP}"
assert_json_field "Status still draft" "$BODY" "['status']['code']" "draft"

echo ""

# ============================================================================
# STEP 11: Submit TFD (draft → pending)
# ============================================================================
bold "▸ Step 11: Submit TFD (draft → pending)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/tfd/requests/$TFD_ID/submit" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Submit TFD" "201" "$HTTP_CODE"
assert_json_field "Status is now pending" "$BODY" "['status']['code']" "pending"

echo ""

# ============================================================================
# STEP 12: Transition pending → in_transit
# ============================================================================
bold "▸ Step 12: Transition TFD (pending → in_transit)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/tfd/requests/$TFD_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"statusCode\": \"in_transit\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Transition to in_transit" "200" "$HTTP_CODE"
assert_json_field "Status is in_transit" "$BODY" "['status']['code']" "in_transit"

echo ""

# ============================================================================
# STEP 13: Update costs
# ============================================================================
bold "▸ Step 13: Update TFD costs"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/tfd/requests/$TFD_ID/costs" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{
    \"transportationCost\": 150.00,
    \"foodCost\": 80.00,
    \"hotelCost\": 200.00
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Update costs" "200" "$HTTP_CODE"
assert_json_field "Transportation cost" "$BODY" "['transportationCost']" "150.00"
assert_json_field "Food cost" "$BODY" "['foodCost']" "80.00"
assert_json_field "Hotel cost" "$BODY" "['hotelCost']" "200.00"

echo ""

# ============================================================================
# STEP 14: Finalize TFD (in_transit → finalized)
# ============================================================================
bold "▸ Step 14: Finalize TFD (in_transit → finalized)"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/tfd/requests/$TFD_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"statusCode\": \"finalized\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Transition to finalized" "200" "$HTTP_CODE"
assert_json_field "Status is finalized" "$BODY" "['status']['code']" "finalized"

echo ""

# ============================================================================
# STEP 15: Verify stats reflect the new TFD
# ============================================================================
bold "▸ Step 15: Verify dashboard stats"

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/tfd/requests/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "Get dashboard stats" "200" "$HTTP_CODE"

TOTAL_STAT=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])" 2>/dev/null || echo "0")
TOTAL=$((TOTAL + 1))
if [ "$TOTAL_STAT" -ge 1 ] 2>/dev/null; then
  green "  ✓ Stats total ≥ 1 (got $TOTAL_STAT)"
  PASSED=$((PASSED + 1))
else
  red "  ✗ Stats total should be ≥ 1, got $TOTAL_STAT"
  FAILED=$((FAILED + 1))
fi

echo ""

# ============================================================================
# STEP 16: Negative test — invalid status transition on finalized TFD
# ============================================================================
bold "▸ Step 16: Negative test — cannot transition finalized TFD"

RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$API_URL/tfd/requests/$TFD_ID/status" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"statusCode\": \"pending\"}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)

assert_status "Reject invalid transition (finalized → pending)" "400" "$HTTP_CODE"

echo ""

# ============================================================================
# SUMMARY
# ============================================================================
bold "═══════════════════════════════════════════════════════════════"
if [ "$FAILED" -eq 0 ]; then
  green "  ALL $TOTAL TESTS PASSED ✓"
else
  red "  $FAILED / $TOTAL TESTS FAILED"
  green "  $PASSED / $TOTAL TESTS PASSED"
fi
bold "═══════════════════════════════════════════════════════════════"

exit "$FAILED"
