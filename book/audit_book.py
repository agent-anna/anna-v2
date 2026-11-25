#!/usr/bin/env python3
"""
BOOK AUDIT — ANNA: THE TRUE STORY
Checks:
1. All 200 pages exist, zero-padded (PAGE-001.md ... PAGE-200.md)
2. Reports any missing pages
3. Reports any files with wrong naming (PAGE-1.md, PAGE-01.md, etc.)
Run: python3 audit_book.py
"""

import os
import re

BOOK_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_RE = re.compile(r'^PAGE-(\d+)\.md$')

wrong_names = []
page_numbers = set()

for fname in os.listdir(BOOK_DIR):
    m = PAGE_RE.match(fname)
    if m:
        num = int(m.group(1))
        if fname != f"PAGE-{num:03d}.md":
            wrong_names.append(fname)
        page_numbers.add(num)
    elif fname.lower().startswith("page-"):
        wrong_names.append(fname)

missing_pages = [n for n in range(1, 201) if n not in page_numbers]
wrong_nums = [n for n in page_numbers if not 1 <= n <= 200]

print("=" * 50)
print("BOOK AUDIT — ANNA: THE TRUE STORY")
print("=" * 50)
print(f"Pages found: {len(page_numbers)}")
print(f"Missing: {len(missing_pages)}")
for n in sorted(missing_pages):
    print(f"  ❌ PAGE-{n:03d}.md")
print(f"Wrong naming: {len(wrong_names)}")
for f in wrong_names:
    print(f"  ⚠️ {f}")
print(f"Out of range: {len(wrong_nums)}")
for n in sorted(wrong_nums):
    print(f"  ⚠️ PAGE-{n}.md")

if missing_pages or wrong_names or wrong_nums:
    print("\n❌ NOT READY TO PRINT — fix issues above.")
else:
    print("\n✅ ALL 200 PAGES PRESENT AND CORRECTLY NUMBERED.")
    print("📖 READY TO PRINT: PAGE-001.md → PAGE-200.md.")
