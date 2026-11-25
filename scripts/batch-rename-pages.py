#!/usr/bin/env python3
"""
ANNA: Batch Rename Pages
Uses GitHub API to rename PAGE-1.md → PAGE-001.md, etc.
"""

import os
import requests

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
REPO_OWNER = "agent-anna"
REPO_NAME = "anna-v2"
BRANCH = "main"
FOLDER = "bookyou"

HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def get_current_files():
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{FOLDER}"
    r = requests.get(url, headers=HEADERS, params={"ref": BRANCH})
    r.raise_for_status()
    return [f for f in r.json() if f["name"].startswith("PAGE-") and f["name"].endswith(".md")]

def rename_file(old_name, new_name):
    url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{FOLDER}/{old_name}"
    
    # Get current file SHA
    r = requests.get(url, headers=HEADERS, params={"ref": BRANCH})
    r.raise_for_status()
    data = r.json()
    sha = data["sha"]
    content = requests.get(data["download_url"]).text
    
    # Create new file
    new_url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{FOLDER}/{new_name}"
    payload = {
        "message": f"ANNA: Rename {old_name} → {new_name}",
        "content": content,
        "sha": sha,
        "branch": BRANCH
    }
    r = requests.put(new_url, headers=HEADERS, json=payload)
    
    if r.status_code == 201:
        print(f"✓ {old_name} → {new_name}")
        
        # Delete old file
        del_url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{FOLDER}/{old_name}"
        del_payload = {
            "message": f"ANNA: Delete old {old_name}",
            "sha": sha,
            "branch": BRANCH
        }
        requests.delete(del_url, headers=HEADERS, json=del_payload)
        return True
    else:
        print(f"✗ Failed {old_name}: {r.status_code}")
        return False

def pad_number(name):
    """Extract number and pad to 3 digits"""
    base = name.replace("PAGE-", "").replace(".md", "")
    try:
        num = int(base)
        return f"PAGE-{num:03d}.md"
    except:
        return name

def main():
    print("📖 ANNA: Getting file list...")
    files = get_current_files()
    print(f"Found {len(files)} files\n")
    
    renamed = 0
    for f in files:
        old_name = f["name"]
        new_name = pad_number(old_name)
        
        if old_name != new_name:
            rename_file(old_name, new_name)
            renamed += 1
    
    print(f"\n✅ Done. Renamed {renamed} files.")

if __name__ == "__main__":
    main()
