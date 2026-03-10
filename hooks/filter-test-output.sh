#!/bin/bash
# Filters test output to show only failures
# Usage: {test command} 2>&1 | bash hooks/filter-test-output.sh

grep -E -A10 "(FAIL|✗|●|not ok|✕|FAILED|Error:|AssertionError)" \
  | head -150
