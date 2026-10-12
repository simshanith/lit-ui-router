---
name: atlas-copy
description: Write or revise words on the Altitude Atlas — a sheet's sub, caption, notes, callouts or key, a HISTORY.md record line, or an atlas commit message. Use before editing any prose under www/atlas.lit-ui-router.dev, even when the request never mentions copy.
---

# Write for the atlas

The rules live in [docs/COPY.md](../../../docs/COPY.md). This skill adds only what an unattended
run needs.

1. Before editing, read the sheet's current `sub`, `caption` and `notes` in its generator module
   and its `## Sheet` section in [HISTORY.md](../../../HISTORY.md). The copy describes the present
   state; the history goes in the record, never in the copy.
2. After editing, scan the changed prose for the forbidden words:
   `grep -n "previously\|formerly\|until\|planned\|will \|used to\|once " <file>`.
   Any hit in a sub, caption, note or callout is a stop.
3. Any count written by hand ("one", "the tallest", "N files") is derived from the plate or
   guarded by a throw before it ships.
4. A caption carries no anchor; a note's anchors go through `npmUrl()` or the sheet's plate-checked
   link helper; a structure is cited through the sheet's name lookup.
5. Record the change as one dated line under the sheet's heading in HISTORY.md, newest first;
   quote the user's words where they decided it.

Report the files touched, the forbidden-word scan's result and the HISTORY line added.
