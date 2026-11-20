# 02 the trunk

* **Single-Shot Inference (`sendMessage`)**: Sends one clean request per prompt with zero automatic retry loops.
* **Speech Guardrail (`stripCodeForSpeech`)**: Strips fenced code blocks, HTML tags, and syntax symbols before TTS speaks.
* **Vault Context Loader (`ingestCoreVaultAssets`)**: Reads verified `.md` and `.json` files from `A1/v3/` while protecting soul/archive paths.
