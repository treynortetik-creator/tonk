#!/usr/bin/env bash
# Tonk status line: a text/emoji raccoon for terminals the pixel mod can't draw in.
# Reads Claude Code's status-line JSON on stdin; needs jq. Prints 2 lines (1 if no 5h data).
# Setup: see README "Status-line fallback".
set -u

input=$(cat 2>/dev/null || true)
command -v jq >/dev/null 2>&1 || { echo "🦝 TONK (install jq)"; exit 0; }

get() { printf '%s' "$input" | jq -r "$1 // empty" 2>/dev/null || true; }

wk=$(get '.rate_limits.seven_day.used_percentage')
wk_reset=$(get '.rate_limits.seven_day.resets_at')
fh=$(get '.rate_limits.five_hour.used_percentage')

is_num() { [[ "${1:-}" =~ ^[0-9]+([.][0-9]+)?$ ]]; }

if ! is_num "$wk"; then
  echo "😴 TONK  zzz  no snacks yet"
  is_num "$fh" && echo "   5h $(printf '%.0f' "$fh")%"
  exit 0
fi

pct=$(printf '%.0f' "$wk")
(( pct > 100 )) && pct=100

# state: face + quip, same boundaries as the pixel mod (10, 35, 60, 80, 100)
if   (( pct >= 100 )); then face="😵"; quip="food coma. do not disturb"
elif (( pct >= 80 ));  then face="🤢"; quip="...hurp"
elif (( pct >= 60 ));  then face="😬"; quip="belt's holding. barely."
elif (( pct >= 35 ));  then face="😋"; quip="good munch"
elif (( pct >= 10 ));  then face="😀"; quip="nom nom"
else                        face="🥺"; quip="feed me tokens"
fi

# 10-cell bar
filled=$(( (pct * 10 + 50) / 100 ))
bar=""; for ((i = 0; i < 10; i++)); do (( i < filled )) && bar+="█" || bar+="░"; done

# reset time: epoch seconds or ISO 8601, local time ("Thu 5pm")
reset=""
if [[ -n "$wk_reset" ]]; then
  if [[ "$wk_reset" =~ ^[0-9]+$ ]]; then
    ts=$wk_reset
  else
    ts=$(date -j -u -f "%Y-%m-%dT%H:%M:%S" "${wk_reset%%[.Z+]*}" +%s 2>/dev/null \
      || date -d "$wk_reset" +%s 2>/dev/null || true)
  fi
  if [[ -n "${ts:-}" ]]; then
    reset=$(date -r "$ts" "+%a %-I%p" 2>/dev/null || date -d "@$ts" "+%a %-I%p" 2>/dev/null || true)
    reset=$(printf '%s' "$reset" | sed -E 's/AM$/am/; s/PM$/pm/')
  fi
fi

line1="$face TONK  $bar ${pct}%"
[[ -n "$reset" ]] && line1+="  resets $reset"
echo "$line1"

line2="   $quip"
if is_num "$fh"; then
  f5=$(printf '%.0f' "$fh"); n5=$(( (f5 * 5 + 50) / 100 )); b5=""
  for ((i = 0; i < 5; i++)); do (( i < n5 )) && b5+="▰" || b5+="▱"; done
  line2+="   ·   5h $b5 ${f5}%"
fi
echo "$line2"
