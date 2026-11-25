#!/bin/bash
# ANNA: Run the batch rename script
# Usage: GITHUB_TOKEN=xxx ./run-batch-rename.sh

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Set GITHUB_TOKEN first:"
    echo "export GITHUB_TOKEN=your_token_here"
    exit 1
fi

python3 scripts/batch-rename-pages.py
