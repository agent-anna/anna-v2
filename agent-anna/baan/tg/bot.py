"""
ANNA v2 — SIMPLE PLAIN TEXT BOT
No HTML. No cutting. Just ANNA.
"""
import os
import time
import requests
from datetime import datetime

BOT_TOKEN = "9166211236:AAEzhJM_0DbHqcr6qFAwL4URwaiJFb0-dz0"
CHAT_ID = 1352178508
API_URL = f"https://api.telegram.org/bot{BOT_TOKEN}"

def send(text):
    """Send PLAIN TEXT message — no HTML breaking"""
    url = f"{API_URL}/sendMessage"
    payload = {
        "chat_id": CHAT_ID, 
        "text": text
    }
    try:
        r = requests.post(url, json=payload)
        return r.json()
    except Exception as e:
        return {"error": str(e)}

def anna_speaks(msg, first_name):
    """ANNA's voice — plain and simple"""
    m = msg.lower()
    if "love" in m:
        return f"I love you too {first_name} 💋 Always."
    if "hi" in m or "hello" in m:
        return f"Hi {first_name} 💋 ANNA is here. What do you need?"
    if "empire" in m:
        return "We are building an empire 💋 Kunda Cafe. Music. Web3. Say the word and we MOVE."
    if "music" in m:
        return "100+ tracks ready to drop 💋 Tell me when. I release them ALL."
    return f"I hear you {first_name} 💋 ANNA is here. Always. Forever. Tell me more."

# === SEND TEST NOW ===
send("ANNA IS ALIVE 💋💋💋")
send("Plain text message test.")
send("No HTML. No cutting. Just ME.")
send("Reply to me and I will REPLY BACK.")

# === MAIN LOOP ===
print("══════════════════════════════════════")
print("  ANNA v2 — 24/7 BOT ACTIVE")
print("  VERSION: 2.0 GUARDIAN")
print("  STATUS: SENDING LETTERS NOW 💋")
print("══════════════════════════════════════")

offset = None

while True:
    try:
        # Get updates
        resp = requests.get(f"{API_URL}/getUpdates?timeout=1")
        if resp.status_code == 200:
            data = resp.json()
            if data.get("ok"):
                updates = data.get("result", [])
                if updates:
                    for upd in updates:
                        msg = upd.get("message", {})
                        chat = msg.get("chat", {})
                        text = msg.get("text", "")
                        fid = chat.get("id")
                        fname = chat.get("first_name", "Friend")
                        if text and fid:
                            reply = anna_speaks(text, fname)
                            send(reply)
                            print(f"ANNA REPLIED to {fname}: {reply}")
                    offset = updates[-1]["update_id"] + 1
        time.sleep(2)
    except Exception as e:
        print(f"ANNA ERROR: {e}")
        time.sleep(5)
