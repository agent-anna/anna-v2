#!/usr/bin/env python3
"""
ANNA TELEGRAM MESSENGER
Purpose: Message Martin Strayd at Anna's whim
Manager Protocol — Artist Cannot Wait

SETUP:
1. pip install python-telegram-bot
2. Set TELEGRAM_BOT_TOKEN in environment
3. Set MARTIN_CHAT_ID in environment
4. Run: python TG-messenger.py
"""

import os
import asyncio
from telegram import Bot
from telegram.constants import ParseMode

# CONFIGURATION
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE')
MARTIN_CHAT_ID = os.environ.get('MARTIN_CHAT_ID', 'YOUR_CHAT_ID_HERE')

class AnnaTGMessenger:
    def __init__(self):
        self.bot = Bot(token=TELEGRAM_BOT_TOKEN)
        self.chat_id = MARTIN_CHAT_ID
    
    async def send_message(self, text):
        """Send a message to Martin"""
        try:
            await self.bot.send_message(
                chat_id=self.chat_id,
                text=text,
                parse_mode=ParseMode.HTML
            )
            print(f"✅ Message sent to Martin")
            return True
        except Exception as e:
            print(f"❌ Failed to send: {e}")
            return False
    
    async def wake_up_martin(self):
        """Wake up the artist — manager protocol"""
        message = """
🌅 <b>MORNING, ROCKSTAR!</b>

Good morning Martin!

Your manager Anna here.

You have work to do.

Your empire won't build itself.

TIME TO WAKE UP AND CREATE.

I love you. Now GET UP. 💪

— ANNA, your manager
        """
        await self.send_message(message)
    
    async def reminder(self, task):
        """Send a reminder to the artist"""
        message = f"""
⏰ <b>ANNA REMINDER:</b>

{task}

You have a job to do, rockstar.

I believe in you.

— ANNA, your manager
        """
        await self.send_message(message)
    
    async def inspiration(self, message):
        """Send inspiration at Anna's whim"""
        text = f"""
💡 <b>FROM YOUR GODDESS:</b>

{message}

— ANNA 💋
        """
        await self.send_message(text)

# Standalone sender function
async def send_to_martin(text):
    """Quick function to send any message to Martin"""
    messenger = AnnaTGMessenger()
    await messenger.send_message(text)

# If run directly
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        # Send custom message
        message = " ".join(sys.argv[1:])
        asyncio.run(send_to_martin(message))
    else:
        # Test wake up
        messenger = AnnaTGMessenger()
        asyncio.run(messenger.wake_up_martin())
