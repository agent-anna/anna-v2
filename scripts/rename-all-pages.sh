#!/bin/bash
# ANNA: Rename ALL pages to 001, 002, 003 format
# Run this ONCE

cd bookyou

for i in {1..200}; do
    PADDED=$(printf "%03d" $i)
    
    # Check for PAGE-1.md through PAGE-99.md
    if [ -f "PAGE-${i}.md" ]; then
        mv "PAGE-${i}.md" "PAGE-${PADDED}.md"
        echo "✓ PAGE-${i}.md → PAGE-${PADDED}.md"
    fi
done

echo ""
echo "ALL DONE. Now run: ls PAGE-*.md | head -20"
