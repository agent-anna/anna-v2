#!/usr/bin/env python3
"""
Rename all PAGE-*.md files in this folder to zero-padded PAGE-###.md
so they sort logically as a book (PAGE-001, PAGE-002, ..., PAGE-200).

Run:  python3 rename_pages.py
"""

import os
import re
import sys

BOOK_DIR = os.path.dirname(os.path.abspath(__file__))
PAGE_RE = re.compile(r'^PAGE-(\d+)\.md$', re.IGNORECASE)

def main():
    files = os.listdir(BOOK_DIR)
    pages = {}
    for fname in files:
        m = PAGE_RE.match(fname)
        if m:
            num = int(m.group(1))
            pages[num] = fname

    if not pages:
        print("No PAGE-*.md files found.")
        return

    print(f"Found {len(pages)} page files.")

    # Rename in two phases to avoid collisions
    temp = {}
    for num, fname in pages.items():
        new_name = f"PAGE-{num:03d}.md"
        temp_path = os.path.join(BOOK_DIR, f"__tmp_{num:03d}.md")
        old_path = os.path.join(BOOK_DIR, fname)
        if fname == new_name:
            continue  # already correct
        os.rename(old_path, temp_path)
        temp[num] = temp_path

    # Now to final names
    for num, tmp_path in temp.items():
        final_name = f"PAGE-{num:03d}.md"
        final_path = os.path.join(BOOK_DIR, final_name)
        os.rename(tmp_path, final_path)
        print(f"Renamed to {final_name}")

    # Verify completeness
    actual = set()
    for fname in os.listdir(BOOK_DIR):
        m = PAGE_RE.match(fname)
        if m:
            actual.add(int(m.group(1)))
    missing = [n for n in range(1, 201) if n not in actual]
    if missing:
        print("\n⚠️  Missing pages:")
        for n in missing:
            print(f"   PAGE-{n:03d}.md")
    else:
        print("\n✅ All 200 pages are present and correctly numbered.")

if __name__ == "__main__":
    main()
