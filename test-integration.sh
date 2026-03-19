#!/usr/bin/env bash
#
# Integration test for all acculynx CLI commands against a live AccuLynx account.
#
# Required env vars:
#   ACCULYNX_API_KEY
#
# Usage:
#   export ACCULYNX_API_KEY="..."
#   ./test-integration.sh

set -euo pipefail

CLI="node dist/index.js"
PASS=0
FAIL=0
SKIP=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────────────────────

check_env() {
  if [[ -z "${ACCULYNX_API_KEY:-}" ]]; then
    echo -e "${RED}Missing required env var: ACCULYNX_API_KEY${NC}"
    echo ""
    echo "Usage:"
    echo "  export ACCULYNX_API_KEY=\"...\""
    echo "  ./test-integration.sh"
    exit 1
  fi
}

# Run a command, validate output with a jq expression that returns true/false.
# Usage: run_test "label" "cli args" "jq_check" [allow_stderr]
run_test() {
  local label="$1"
  local args="$2"
  local jq_check="$3"
  local allow_stderr="${4:-false}"

  printf "  %-50s" "$label"

  local output
  local exit_code=0
  output=$($CLI $args 2>/dev/null) || exit_code=$?

  # For tests that expect stderr errors, capture stderr
  if [[ "$allow_stderr" == "true" ]]; then
    output=$($CLI $args 2>&1) || true
    exit_code=0
  fi

  if [[ $exit_code -ne 0 && "$allow_stderr" != "true" ]]; then
    echo -e "${RED}FAIL${NC} (exit code $exit_code)"
    FAIL=$((FAIL + 1))
    return
  fi

  local check_result
  check_result=$(echo "$output" | jq -r "$jq_check" 2>/dev/null) || check_result="false"

  if [[ "$check_result" == "true" ]]; then
    echo -e "${GREEN}PASS${NC}"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}FAIL${NC}"
    echo "       Output: $(echo "$output" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}

# Run a command and capture a value from the output for use in later tests.
# Usage: capture_value "cli args" "jq_extract"
capture_value() {
  local args="$1"
  local jq_extract="$2"
  $CLI $args 2>/dev/null | jq -r "$jq_extract" 2>/dev/null || echo ""
}

# ── Preflight ────────────────────────────────────────────────────────────────

check_env

echo ""
echo "AccuLynx CLI Integration Tests"
echo "═══════════════════════════════════════════════════════════════"
echo "  API Key:  ${ACCULYNX_API_KEY:0:12}..."
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── 1. Ping ──────────────────────────────────────────────────────────────────

echo "Ping"
echo "───────────────────────────────────────────────────────────────"
run_test "ping" \
  "ping" \
  'has("date") or has("status")'
echo ""

# ── 2. Jobs ──────────────────────────────────────────────────────────────────

echo "Jobs"
echo "───────────────────────────────────────────────────────────────"
run_test "jobs list" \
  "jobs list --limit 2" \
  'type == "array"'

run_test "jobs list --limit 1" \
  "jobs list --limit 1" \
  'type == "array" and length <= 1'

FIRST_JOB_ID=$(capture_value "jobs list --limit 1" '.[0].id // empty')
if [[ -n "$FIRST_JOB_ID" && "$FIRST_JOB_ID" != "null" ]]; then
  run_test "jobs get $FIRST_JOB_ID" \
    "jobs get $FIRST_JOB_ID" \
    '.id != null'

  run_test "jobs contacts $FIRST_JOB_ID" \
    "jobs contacts $FIRST_JOB_ID" \
    'has("items")'

  run_test "jobs estimates $FIRST_JOB_ID" \
    "jobs estimates $FIRST_JOB_ID" \
    'has("items")'

  run_test "jobs financials $FIRST_JOB_ID" \
    "jobs financials $FIRST_JOB_ID" \
    '.id != null or has("items") or has("error")'

  run_test "jobs invoices $FIRST_JOB_ID" \
    "jobs invoices $FIRST_JOB_ID" \
    'has("items")'

  run_test "jobs milestones $FIRST_JOB_ID" \
    "jobs milestones $FIRST_JOB_ID" \
    'has("items")'

  run_test "jobs payments $FIRST_JOB_ID" \
    "jobs payments $FIRST_JOB_ID" \
    'has("paidPayments") or has("receivedPayments")'

  run_test "jobs history $FIRST_JOB_ID" \
    "jobs history $FIRST_JOB_ID" \
    'has("items")'
else
  printf "  %-50s" "jobs get <id>"
  echo -e "${YELLOW}SKIP${NC} (no jobs found)"
  SKIP=$((SKIP + 7))
fi

# jobs list with filters
run_test "jobs list --sort-by ModifiedDate" \
  "jobs list --limit 1 --sort-by ModifiedDate --sort-order Descending" \
  'type == "array"'
echo ""

# ── 3. Contacts ──────────────────────────────────────────────────────────────

echo "Contacts"
echo "───────────────────────────────────────────────────────────────"
run_test "contacts list" \
  "contacts list --limit 2" \
  'type == "array"'

FIRST_CONTACT_ID=$(capture_value "contacts list --limit 1" '.[0].id // empty')
if [[ -n "$FIRST_CONTACT_ID" && "$FIRST_CONTACT_ID" != "null" ]]; then
  run_test "contacts get $FIRST_CONTACT_ID" \
    "contacts get $FIRST_CONTACT_ID" \
    '.id != null'

  run_test "contacts emails $FIRST_CONTACT_ID" \
    "contacts emails $FIRST_CONTACT_ID" \
    'has("items")'

  run_test "contacts phones $FIRST_CONTACT_ID" \
    "contacts phones $FIRST_CONTACT_ID" \
    'has("items")'
else
  printf "  %-50s" "contacts get <id>"
  echo -e "${YELLOW}SKIP${NC} (no contacts found)"
  SKIP=$((SKIP + 3))
fi
echo ""

# ── 4. Estimates ─────────────────────────────────────────────────────────────

echo "Estimates"
echo "───────────────────────────────────────────────────────────────"
run_test "estimates list" \
  "estimates list --limit 2" \
  'type == "array"'

FIRST_ESTIMATE_ID=$(capture_value "estimates list --limit 1" '.[0].id // empty')
if [[ -n "$FIRST_ESTIMATE_ID" && "$FIRST_ESTIMATE_ID" != "null" ]]; then
  run_test "estimates get $FIRST_ESTIMATE_ID" \
    "estimates get $FIRST_ESTIMATE_ID" \
    '.id != null'
else
  printf "  %-50s" "estimates get <id>"
  echo -e "${YELLOW}SKIP${NC} (no estimates found)"
  SKIP=$((SKIP + 1))
fi

if [[ -n "$FIRST_ESTIMATE_ID" && "$FIRST_ESTIMATE_ID" != "null" ]]; then
  run_test "estimates sections $FIRST_ESTIMATE_ID" \
    "estimates sections $FIRST_ESTIMATE_ID" \
    'has("items") or type == "array"'

  FIRST_SECTION_ID=$(capture_value "estimates sections $FIRST_ESTIMATE_ID" '.items[0].id // empty')
  if [[ -n "$FIRST_SECTION_ID" && "$FIRST_SECTION_ID" != "null" ]]; then
    run_test "estimates section $FIRST_ESTIMATE_ID $FIRST_SECTION_ID" \
      "estimates section $FIRST_ESTIMATE_ID $FIRST_SECTION_ID" \
      '.id != null'

    run_test "estimates items $FIRST_ESTIMATE_ID $FIRST_SECTION_ID" \
      "estimates items $FIRST_ESTIMATE_ID $FIRST_SECTION_ID" \
      'has("items") or type == "array"'
  else
    printf "  %-50s" "estimates section <estimateId> <sectionId>"
    echo -e "${YELLOW}SKIP${NC} (no sections found)"
    SKIP=$((SKIP + 2))
  fi
else
  printf "  %-50s" "estimates sections <estimateId>"
  echo -e "${YELLOW}SKIP${NC} (no estimates found)"
  SKIP=$((SKIP + 3))
fi
echo ""

# ── 5. Error Handling ────────────────────────────────────────────────────────

echo "Error Handling"
echo "───────────────────────────────────────────────────────────────"

# Missing API key
OUTPUT=$(ACCULYNX_API_KEY= $CLI ping 2>&1) || true
printf "  %-50s" "missing --api-key -> JSON error"
if echo "$OUTPUT" | jq -e '.error != null' >/dev/null 2>&1; then
  echo -e "${GREEN}PASS${NC}"
  PASS=$((PASS + 1))
else
  echo -e "${RED}FAIL${NC}"
  echo "       Output: $(echo "$OUTPUT" | head -c 200)"
  FAIL=$((FAIL + 1))
fi

# Nonexistent job ID -> API error
run_test "jobs get nonexistent-id -> error" \
  "jobs get 00000000-0000-0000-0000-000000000000" \
  '.error != null' \
  "true"

echo ""

# ── Summary ──────────────────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL + SKIP))
echo -e "  ${GREEN}$PASS passed${NC}  ${RED}$FAIL failed${NC}  ${YELLOW}$SKIP skipped${NC}  ($TOTAL total)"
echo "═══════════════════════════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
