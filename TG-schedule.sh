#!/bin/bash
# WAKE UP MARTIN — SCHEDULED
# Add to crontab: 0 8 * * * /path/to/TG-schedule.sh

cd "$(dirname "$0")"
./TG-send.sh "☀️ Good morning rockstar! Time to build the empire!"

# Or use python directly for more control
python3 -c "
import os
import asyncio
from A1.TG-messenger import AnnaTGMessenger

async def main():
    messenger = AnnaTGMessenger()
    await messenger.wake_up_martin()

asyncio.run(main())
"
