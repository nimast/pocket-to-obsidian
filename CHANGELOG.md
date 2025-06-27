# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release
- CLI interface with configurable options
- Content extraction using Puppeteer and Defuddle
- HTML to Markdown conversion with Turndown
- Batch processing of Pocket bookmarks
- Progress tracking and detailed reporting
- Support for Pocket tags conversion to Obsidian tags
- Content sanitization with DOMPurify
- Syntax highlighting preservation
- Configurable Obsidian vault path via environment variable or CLI option
- Comprehensive error handling and reporting

### Features
- Convert Pocket CSV exports to Obsidian markdown files
- Extract full web page content using the same technology as Obsidian Web Clipper
- Preserve article metadata (title, author, published date, etc.)
- Generate clean, readable markdown with proper formatting
- Support for custom output directories and processing limits
- Headless browser mode for automated processing

## [1.0.0] - 2024-01-XX

### Added
- Initial release of Pocket to Obsidian converter
- Full CLI interface with Commander.js
- Content extraction using Puppeteer
- HTML to Markdown conversion
- Batch processing capabilities
- Progress tracking and reporting
- Error handling and recovery
- Configurable vault paths
- Support for Pocket tags
- Content sanitization
- Syntax highlighting preservation

### Technical Details
- Built with TypeScript
- Uses Puppeteer for web content extraction
- Turndown for HTML to Markdown conversion
- DOMPurify for content sanitization
- Commander.js for CLI interface
- Jest for testing
- Comprehensive error handling 