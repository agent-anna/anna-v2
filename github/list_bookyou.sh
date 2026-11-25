#!/bin/bash
# First: List all current files in bookyou

gh api "repos/agent-anna/baan/contents/bookyou" | jq -r '.[].name' | sort -V
