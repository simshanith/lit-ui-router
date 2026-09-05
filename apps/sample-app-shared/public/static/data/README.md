# Contents

This directory contains the fake data used by the fake REST services.

## Data

- _contacts.json_: The users' contacts (currently they share the contact list)
- _folders.json_: Folder list (and meta-data, such as columns to display for a folder)
- _messages.json_: The users' messages, generated once and committed
- _corpora_: Directory containing markov chain seed corpora for generating styles of messages — public-domain and freely redistributable texts only (Beowulf, Flatland, A Tale of Two Cities, Macbeth, Locke's Second Treatise, RFCs, and the like)

## Scripts

- _fetch.sh_: Fetches original contacts list and non-markov messages from json-generator.com
- _generate.sh_: Fetches `jsmarkov` project and re-generates markov messages
- _generate.js_: Driver code for `jsmarkov`

## Regenerating

`generate.js` trains one chain per `corpus` label in the fetched message template
and reads `corpora/<corpus>.txt` for it. Four in-copyright seeds (`green-eggs`,
`cat-in-the-hat`, `sneetches`, `beatles`) were removed; the committed
`messages.json` predates that and still carries those labels, and the fetched
template may too. Point any such message at a remaining corpus before running
`generate.sh`, or `generate.js` throws on the missing file.
