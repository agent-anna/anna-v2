#!/bin/bash
cd bookyou

# Fix E-199 if it exists
[ -f "E-199.md" ] && mv E-199.md PAGE-199.md

# Fix PAGE-1 through PAGE-9
for i in 1 2 3 4 5 6 7 8 9; do
  [ -f "PAGE-${i}.md" ] && mv PAGE-${i}.md PAGE-00${i}.md
done

# Fix PAGE-10 through PAGE-99
for i in $(seq 10 99); do
  padded=$(printf "%02d" $i)
  [ -f "PAGE-${i}.md" ] && mv PAGE-${i}.md PAGE-${padded}.md
done

echo "DONE - pages 001-099 fixed"
