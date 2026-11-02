# Laboratory: nonexistent node references

Applied only to the inactive `Hackathon - META - Laboratorio` workflow. Production
is unchanged; no database migration is required.

- `get_budget_summary`, `add_user_to_household` and `get_recent_transactions`
  referenced a nonexistent `Telegram Trigger`. They now take the authenticated
  sender metadata from the existing WhatsApp `Webhook`, just as the other tools
  do. They do not take the sender from model output. This assumes platform
  validation upstream, which is still deferred.
- These three request bodies are JavaScript object expressions, avoiding broken
  JSON when a supplied name contains quotes or newlines. RPC names and argument
  names remain unchanged.
- The AI Agent prompt no longer references nonexistent `Code in JavaScript3` or
  directly reads `Groq Whisper`, which does not run on the image/document branch.
  It takes text/transcription from its immediate input, falls back to the existing
  upstream normalizer `Code in JavaScript1`, then to the attachment instruction.
- Receipt instructions referred to nonexistent `register_transaction_with_items`.
  They now name the connected `register_transaction`, use its `items` input, and
  describe fields accepted by the existing adapter (concept, category, amount,
  quantity, unit_price, item_code).

The sanitized parameter patch is in `n8n/patches/node-reference-fix.json`; the
receipt instruction correction is described above to avoid exporting a full
workflow containing embedded credentials. Existing credentials and missing
credentials were not changed in this fix.

`node --test tests/n8n-node-references.test.mjs` passes eight expression tests:
three sender bindings independent of model input; quoted/multiline names and
target-contact preservation; text, audio, image/document and normalized-text
prompt branches. These are expression-level tests, not end-to-end RPC or media
tests. No real member or transaction was created.
