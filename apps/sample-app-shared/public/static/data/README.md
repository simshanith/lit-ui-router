# Contents

This directory contains the fake data used by the fake REST services.

- _contacts.json_: The users' contacts (currently they share the contact list)
- _folders.json_: Folder list (and meta-data, such as columns to display for a folder)
- _messages.json_: The users' messages

All three are static fixtures. The message bodies were generated once, upstream in the
ui-router sample apps, from Markov chains over seed corpora; the seeds and the generation
scripts are not kept in this repository, so treat `messages.json` as authored data and edit
it directly.
