## Contents

This directory contains the fake data used by the fake REST services.

### Data

- _contacts.json_: The users' contacts (currently they share the contact list)
- _folders.json_: Folder list (and meta-data, such as columns to display for a folder)
- _messages.json_: The users' messages
- _corpora_: Directory containing markov chain seed corpora for generating styles of messages

### Scripts

- _fetch.sh_: Fetches original contacts list and non-markov messages from json-generator.com
- _generate.sh_: Fetches `jsmarkov` project and re-generates markov messages
- _generate.js_: Driver code for `jsmarkov`
