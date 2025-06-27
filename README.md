# Pocket to Obsidian

A powerful tool to convert your Pocket bookmarks to Obsidian markdown files using the same technology as Obsidian Web Clipper. This tool extracts the full content of web pages and converts them to clean, readable markdown files that integrate seamlessly with your Obsidian vault.

---

**⚠️ Minimal Maintenance Notice**

- This project was originally created for private use and is being open sourced as a courtesy to the community.
- **No support is provided or guaranteed.**
- **Minimal to no maintenance** should be expected.
- **Pull Requests (PRs) are welcome.**
- **Issues without an accompanying PR will be closed without response.** This policy may change in the future.
- **Feature requests are not accepted.**

---

## Features

- 🚀 **Fast Content Extraction**: Uses Puppeteer to extract full web page content
- 📝 **Clean Markdown**: Converts HTML to clean, readable markdown using Turndown
- 🏷️ **Smart Tagging**: Preserves Pocket tags and converts them to Obsidian tags
- 📊 **Batch Processing**: Process hundreds of bookmarks in one go
- 📈 **Progress Tracking**: Real-time progress indicators and detailed reporting
- 🔒 **Content Sanitization**: Safely handles HTML content with DOMPurify
- 🎨 **Syntax Highlighting**: Preserves code syntax highlighting

## Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- An Obsidian vault

### Install the tool

```bash
# Clone the repository
git clone https://github.com/yourusername/pocket-to-obsidian.git
cd pocket-to-obsidian

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

### 1. Export your Pocket data

1. Go to [Pocket's export page](https://getpocket.com/export)
2. Download your data as a CSV file
3. Place the CSV file in your project directory (default: `part_000000.csv`)

### 2. Configure your Obsidian vault

Set your Obsidian vault path using one of these methods:

**Environment variable:**
```bash
export OBSIDIAN_VAULT_PATH="/path/to/your/obsidian/vault"
```

**Or use the CLI option:**
```bash
npm start -- --vault "/path/to/your/obsidian/vault" --csv "your-pocket-export.csv"
```

### 3. Run the conversion

```bash
# Basic usage (uses environment variable for vault path and defaults to part_000000.csv in the project folder)
npm start

# With custom paths
npm start -- --vault "/path/to/vault" --csv "pocket-export.csv"

# Process specific items only
npm start -- --vault "/path/to/vault" --csv "pocket-export.csv" --limit 10
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--vault <path>` | Path to your Obsidian vault | `OBSIDIAN_VAULT_PATH` env var |
| `--csv <file>` | Path to Pocket CSV export | `part_000000.csv` in project folder |
| `--limit <number>` | Limit number of items to process | All items |
| `--output <path>` | Custom output directory | `outputs/run-{timestamp}` |
| `--help` | Show help information | - |

## Output Structure

The tool creates markdown files in your Obsidian vault with the following structure:

```
Your Vault/
├── Pocket/
│   ├── Article Title 1.md
│   ├── Article Title 2.md
│   └── ...
└── ...
```

Each markdown file contains:
- Original article title and URL
- Full article content converted to markdown
- Pocket tags converted to Obsidian tags
- Metadata (date added, reading time, etc.)
- Source attribution

## Configuration

### Environment Variables

- `OBSIDIAN_VAULT_PATH`: Default path to your Obsidian vault
- `PUPPETEER_HEADLESS`: Set to `false` to see browser during extraction (default: `true`)

### Customizing Output

You can customize the markdown generation by modifying the `markdown-generator.ts` file. The tool supports:

- Custom frontmatter templates
- Different tag formats
- Custom file naming conventions
- Content filtering and processing

## Development

### Setup

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration
```

### Project Structure

```
src/
├── core/
│   ├── cli.ts              # CLI interface
│   ├── content-extractor.ts # Web content extraction
│   ├── csv-parser.ts       # Pocket CSV parsing
│   ├── file-manager.ts     # File operations
│   └── markdown-generator.ts # Markdown generation
├── types/
│   └── index.ts           # TypeScript type definitions
├── utils/
│   └── slugify.ts         # Utility functions
└── index.ts               # Main entry point
```

## Troubleshooting

### Common Issues

**"Cannot find module" errors:**
```bash
npm run build
```

**Puppeteer installation issues:**
```bash
# On macOS
brew install chromium

# On Ubuntu/Debian
sudo apt-get install chromium-browser
```

**Permission errors:**
Make sure you have write permissions to your Obsidian vault directory.

### Debug Mode

Run with debug logging:
```bash
DEBUG=* npm start
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

- **Pull Requests (PRs) are welcome.**
- **Issues without PRs will be closed without response.**
- **Feature requests are not accepted.**

## License

This project is licensed under the Creative Commons Attribution 4.0 International License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Obsidian](https://obsidian.md/) for the amazing note-taking platform
- [Puppeteer](https://pptr.dev/) for web content extraction
- [Turndown](https://github.com/mixmark-io/turndown) for HTML to Markdown conversion
- [DOMPurify](https://github.com/cure53/DOMPurify) for content sanitization

## Support

**No support is provided or guaranteed.**

If you encounter any issues or have questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Search existing [issues](https://github.com/yourusername/pocket-to-obsidian/issues)
3. Create a PR if you have a fix or improvement

## Roadmap

- [ ] Support for Pocket's JSON export format
- [ ] Custom markdown templates
- [ ] Batch processing with resume capability
- [ ] Integration with Obsidian plugins
- [ ] Web interface for configuration
- [ ] Support for other bookmarking services

---

Made with ❤️ for the Obsidian community 