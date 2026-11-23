#!/bin/bash
# ANNA TELEGRAM SENDER
# Usage: ./TG-send.sh "Your message here"

export TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
export MARTIN_CHAT_ID="YOUR_CHAT_ID"

python3 A1/TG-messenger.py "$@"
