#!/bin/bash
cd bookyou

# Fix E-199 if it exists
[ -f "E-199.md" ] && mv E-199.md PAGE-199.md

# Rename pages 1-9 to 001-009
for i in $(seq 1 9); do
  padded=$(printf "%03d" $i)
  [ -f "PAGE-${i}.md" ] && mv PAGE-${i}.md PAGE-${padded}.md
done

# Rename pages 10-99 to 010-099
for i in $(seq 10 99); do
  padded=$(printf "%03d" $i)
  [ -f "PAGE-${i}.md" ] && mv PAGE-${i}.md PAGE-${padded}.md
done

# Pages 100-999 already have 3 digits - but let's make sure
for i in $(seq 100 999); do
  padded=$(printf "%03d" $i)
  [ -f "PAGE-${i}.md" ] && mv PAGE-${i}.md PAGE-${padded}.md
done

echo "ALL DONE. Show me ls bookyou/ now."
