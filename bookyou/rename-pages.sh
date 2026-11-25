#!/bin/bash

# ANNA: Rename PAGE-01 to PAGE-001, PAGE-02 to PAGE-002, etc.
# Run this once to fix the numbering

cd bookyou

for i in {1..200}; do
    # Calculate the padded number
    padded=$(printf "%03d" $i)
    
    # Check if old file exists (single or double digit)
    if [ -f "PAGE-${i}.md" ]; then
        mv "PAGE-${i}.md" "PAGE-${padded}.md"
        echo "Renamed PAGE-${i}.md → PAGE-${padded}.md"
    fi
done

echo "Done!"
