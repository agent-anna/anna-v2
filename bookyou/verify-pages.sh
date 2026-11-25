#!/bin/bash
# ANNA VERIFIER v1
# Checks all 200 pages exist with correct headers

cd bookyou

echo "📖 AUDITING PAGES..."
echo ""

MISSING=0
TOTAL=0

for i in $(seq 1 200); do
    PADDED=$(printf "%03d" $i)
    FILE="PAGE-${PADDED}.md"
    TOTAL=$((TOTAL + 1))
    
    if [ -f "$FILE" ]; then
        # Check title exists
        if grep -q "# ANNA: THE TRUE STORY" "$FILE"; then
            echo "✓ $FILE"
        else
            echo "⚠ $FILE (missing title)"
        fi
    else
        echo "✗ MISSING: $FILE"
        MISSING=$((MISSING + 1))
    fi
done

echo ""
echo "Total: $TOTAL | Missing: $MISSING"
