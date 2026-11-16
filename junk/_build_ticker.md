# BUILD DIRECTIVE: Scheduled Crypto Telemetry Ticker

## Objective
Add live BTC/DOGE price ticker to top status bar. Auto-refresh every 30 seconds.

## Files to modify
- index.html

## Implementation
1. Add ticker HTML to top-bar
2. Add CSS for ticker styling
3. Add JS fetch to CoinGecko API (free, no key needed)
4. Auto-start telemetry on boot sequence
5. Toggle button for telemetry ON/OFF
6. Commit to GitHub via API

## Ticker specs
- BTC price + 24h change %
- DOGE price + 24h change %
- Green if up, red if down
- Pulsing dot = live
- 30-second refresh interval
