# Pocket to Obsidian

Convert your Pocket bookmarks to Obsidian markdown files using the same technology as Obsidian Web Clipper. Since Pocket is being retired, this tool helps you migrate your saved articles to Obsidian.

---

**Note:** This was made for personal use and shared as-is. No maintenance guaranteed, but PRs are welcome!

---

## Features

- 🚀 Extract full web page content
- 📝 Convert to clean markdown
- 🏷️ Preserve Pocket tags and auto-detect keywords from article metadata & body text
- ⏱️ Capture reading time (Pocket tag, on-page hints, or word-count estimate)
- 📊 Batch process hundreds of bookmarks
- 📈 Progress tracking
- 🔒 Safe content handling
- 🔄 Resume failed conversions

## Quick Start

1. **Install**
   ```bash
   git clone https://github.com/yourusername/pocket-to-obsidian.git
   cd pocket-to-obsidian
   npm install
   npm run build
   ```

2. **Export from Pocket**
   - Go to [Pocket's export page](https://getpocket.com/export)
   - Download as CSV
   - Place in project folder (default: `part_000000.csv`)

3. **Set your vault path**
   ```bash
   export OBSIDIAN_VAULT_PATH="/path/to/your/vault"
   ```

4. **Run**
   ```bash
   npm start
   ```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--vault <path>` | Obsidian vault path | `OBSIDIAN_VAULT_PATH` env var |
| `--csv <file>` | Pocket CSV file | `part_000000.csv` |
| `--limit <number>` | Limit items to process | All items |
| `--headless <boolean>` | Run the browser in headless mode | `true` |
| `--workers <number>` | Concurrent extraction workers | `5` |
| `--retry-failed` | Process only URLs that previously failed (per `progress.json`) | `false` |

## Resume Failed Conversions

Progress is tracked in `progress.json` at the project root (keys include `processedUrls` and `failedUrls`). If a run stops early or some items fail, simply rerun:

```bash
npm start
```

The tool skips URLs already marked as processed and leaves failed URLs for later (titles like “404” / “Page not found”, login/maintenance screens, and near-empty clips are all treated as failures). To retry only the failed set:

```bash
npm start -- --retry-failed
```

Extractions that produce less than 10 words or 100 characters of body text are recorded as failures and remain in the retry queue.

To start from scratch, delete `progress.json` or run:

```bash
node reset-progress.js
```

## Output

Files are created in your vault under a `Pocket/` folder with:
- Article title and URL
- Full content in markdown
- Pocket tags as Obsidian tags
- Auto-detected tags sourced from page metadata and on-page keywords
- Metadata (date, author, etc.)
- The extracted title as the filename (with the Pocket timestamp appended only when needed to avoid collisions)

## Development

```bash
npm install
npm run dev
npm test
```

## Contributing

PRs welcome! No issues or feature requests please.

## License

Creative Commons Attribution 4.0 International 
