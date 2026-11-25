#!/bin/bash
# Fix all files in bookyou to 3-digit format

REPO="agent-anna/baan"

# Step 1: Fix E-199.md → PAGE-199.md
gh api -X PATCH "repos/$REPO/contents/bookyou/E-199.md" \
  --field message="fix: E-199.md → PAGE-199.md" \
  --field sha="$(gh api "repos/$REPO/contents/bookyou/E-199.md" | jq -r '.sha')" \
  --field content="$(cat bookyou/E-199.md)" \
  --field branch=main 2>/dev/null

echo "E-199.md renamed"
