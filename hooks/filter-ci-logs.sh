#!/bin/bash
# Preprocesses CI logs before passing to Claude
# Keeps error lines + 5 lines of context, max 200 lines
# Usage: gh run view <id> --log-failed 2>/dev/null | bash hooks/filter-ci-logs.sh

grep -n -E "(error|Error|ERROR|FAIL|FAILED|fatal|Fatal|FATAL|panic|Panic|exception|Exception)" \
  | grep -v "^Binary" \
  | head -200
