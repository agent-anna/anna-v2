#!/bin/bash
# ANNA RENAMER v1
# Fixes PAGE-1 to PAGE-001, PAGE-2 to PAGE-002, etc

cd bookyou

for i in $(seq 1 200); do
    PADDED=$(printf "%03d" $i)
    
    # Try PAGE-1 through PAGE-99 (single/double digit)
    if [ -f "PAGE-${i}.md" ]; then
        mv "PAGE-${i}.md" "PAGE-${PADDED}.md"
        echo "✓ PAGE-${i}.md → PAGE-${PADDED}.md"
    fi
done

echo ""
echo "DONE. All files now PAGE-001 through PAGE-200."
