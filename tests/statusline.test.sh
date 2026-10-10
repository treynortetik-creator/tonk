#!/usr/bin/env bash
# Pipes sample JSON through statusline/tonk-statusline.sh and checks the output. Run: bash tests/statusline.test.sh
cd "$(dirname "$0")/.." || exit 1
S=statusline/tonk-statusline.sh
fail=0
check() { # name json pattern
  out=$(printf '%s' "$2" | bash "$S" 2>&1)
  if printf '%s' "$out" | grep -Eq "$3"; then echo "ok   $1"; else echo "FAIL $1"; echo "$out"; fail=1; fi
}
check "skinny"        '{"rate_limits":{"seven_day":{"used_percentage":4}}}' 'TONK  ░{10} 4%'
check "round + reset" '{"rate_limits":{"seven_day":{"used_percentage":50,"resets_at":1791500400}}}' '█{5}░{5} 50%  resets [A-Z][a-z]{2} [0-9]+[ap]m'
check "bloated"       '{"rate_limits":{"seven_day":{"used_percentage":92.2}}}' '92%'
check "coma"          '{"rate_limits":{"seven_day":{"used_percentage":100}}}' 'food coma'
check "over 100 caps" '{"rate_limits":{"seven_day":{"used_percentage":130}}}' '100%'
check "5h line"       '{"rate_limits":{"seven_day":{"used_percentage":50},"five_hour":{"used_percentage":40}}}' '5h ▰▰▱▱▱ 40%'
check "ISO reset"     '{"rate_limits":{"seven_day":{"used_percentage":50,"resets_at":"2026-10-15T00:00:00Z"}}}' 'resets '
check "no data"       '{}' 'no snacks yet'
check "empty stdin"   '' 'no snacks yet'
check "garbage"       'not json' 'no snacks yet'
check "5h only"       '{"rate_limits":{"five_hour":{"used_percentage":40}}}' '5h 40%'
exit $fail
