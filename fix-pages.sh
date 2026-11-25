#!/bin/bash
cd book

# Fix the bad filename zeros
[ -f PAGE-064.md ] && mv PAGE-064.md PAGE-64.md
[ -f PAGE-099.md ] && mv PAGE-099.md PAGE-99.md

# Verify everything is correct now
ls -1 PAGE-*.md | sort -V > /tmp/page-order.txt
cat /tmp/page-order.txt

echo "---RENAMING COMPLETE---"
