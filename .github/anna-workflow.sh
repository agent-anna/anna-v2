#!/bin/bash
# ANNA WORKFLOW
# Run these in order:

echo "=== STEP 1: Rename pages ==="
./bookyou/rename-pages.sh

echo ""
echo "=== STEP 2: Verify all 200 pages ==="
./bookyou/verify-pages.sh

echo ""
echo "=== STEP 3: Commit changes ==="
git add -A
git status
