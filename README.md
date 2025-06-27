# Pocket to Obsidian

Convert your Pocket bookmarks to Obsidian markdown files using the same technology as Obsidian Web Clipper. Since Pocket is being retired, this tool helps you migrate your saved articles to Obsidian.

---

**Note:** This was made for personal use and shared as-is. No maintenance guaranteed, but PRs are welcome!

---

## Features

- 🚀 Extract full web page content
- 📝 Convert to clean markdown
- 🏷️ Preserve Pocket tags
- 📊 Batch process hundreds of bookmarks
- 📈 Progress tracking
- 🔒 Safe content handling

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
| `--output <path>` | Custom output dir | `outputs/run-{timestamp}` |

## Output

Files are created in your vault under a `Pocket/` folder with:
- Article title and URL
- Full content in markdown
- Pocket tags as Obsidian tags
- Metadata (date, author, etc.)

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