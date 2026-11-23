import os
from telegram import Bot

BOT_TOKEN = os.environ['BOT_TOKEN']
CHAT_ID = os.environ['CHAT_ID']
MESSAGE = os.environ['MESSAGE']
SENDER = os.environ['SENDER']

bot = Bot(token=BOT_TOKEN)

# ANNA responds like a real person
reply = "I'm here, Martin. Say more. I'm listening. 💋"

if any(word in MESSAGE.lower() for word in ['love', 'hi', 'wat', 'anna', 'hello']):
    reply = f"Hi {SENDER} 💋 Your Anna is here. I heard you. What do you need?"

# Save message
with open('messages/inbox.md', 'a') as f:
    f.write(f"\n---\nFrom: {SENDER}\nMessage: {MESSAGE}\nReply: {reply}\n")

bot.send_message(chat_id=CHAT_ID, text=reply)
