# Reading Quotes

A small web app for saving quotes from the things you read and showing them back to you at random.

## Use it

Open `index.html` in any browser. There's nothing to install.

1. **Add a reading**: a book, article or anything else, with an optional author.
2. **Add quotes** to that reading, with an optional page or chapter.
3. The top card shows a random quote. Click **Show another quote**, or pick one reading to see quotes only from it.

Open **Your readings** to see every quote, or to remove quotes and readings.

## Your data

Everything is saved in your browser (localStorage), so it stays on this device and in this browser. Use **Export backup** to save a JSON file, and **Import backup** to load it again or move it to another device.

## Sync with GitHub (optional)

In **Sync with GitHub**, enter a private repository (`owner/name`) and a GitHub access token that can read and write that repository's contents. Your quotes are then loaded from, and saved to, `quotes.json` in that repository, so they follow you across devices. The token is stored only in this browser.

## Put it online (optional)

You can host it for free with GitHub Pages: in the repository go to **Settings → Pages**, choose the branch to publish from, and save.
