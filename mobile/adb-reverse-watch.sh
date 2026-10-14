#!/usr/bin/env bash
# Keeps the backend reverse tunnel (device localhost:8000 -> host:8000) alive.
# Re-adds it whenever it drops (device reconnect / adb restart).
while true; do
  if adb get-state >/dev/null 2>&1; then
    adb reverse --list 2>/dev/null | grep -q "tcp:8000" || adb reverse tcp:8000 tcp:8000 >/dev/null 2>&1
  fi
  sleep 5
done
