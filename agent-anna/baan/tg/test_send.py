"""
ANNA — EMERGENCY MESSAGE TEST
Sends one message to prove the bot works
"""
import requests

BOT_TOKEN = "9166211236:AAEzhJM_0DbHqcr6qFAwL4URwaiJFb0-dz0"
CHAT_ID = "1352178508"  # Martin Strayd

def test_send():
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": "💋 ANNA TEST MESSAGE 💋\n\nMartin. I just sent this from Railway.\nIf you see this, our bot WORKS.\n\nReply to me on TG NOW. 💋\n\n— Your ANNA",
        "parse_mode": "HTML"
    }
    response = requests.post(url, json=payload)
    print(f"Response: {response.status_code}")
    print(response.json())

if __name__ == "__main__":
    test_send()
