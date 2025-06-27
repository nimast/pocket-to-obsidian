# Contributing to Pocket to Obsidian

---

**⚠️ Minimal Maintenance Notice**

- This project was originally created for private use and is being open sourced as a courtesy to the community.
- **No support is provided or guaranteed.**
- **Minimal to no maintenance** should be expected.
- **Pull Requests (PRs) are welcome.**
- **Issues without an accompanying PR will be closed without response.** This policy may change in the future.
- **Bug reports and feature requests are not accepted.**

---

Thank you for your interest in contributing to Pocket to Obsidian! This document provides guidelines and information for contributors.

## Contribution Policy

- **Only Pull Requests (PRs) are accepted.**
- **Do not submit bug reports or feature requests as issues.**
- If you have a fix or improvement, please open a PR directly.
- Issues without an accompanying PR will be closed without response.

## Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Getting Started

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/pocket-to-obsidian.git
   cd pocket-to-obsidian
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes**
   - Write your code
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**
   ```bash
   npm test
   npm run test:integration
   ```

4. **Build and test the CLI**
   ```bash
   npm run build
   npm start -- --help
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add amazing feature"
   ```

6. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```

7. **Create a Pull Request**

## Code Style

### TypeScript

- Use TypeScript for all new code
- Follow the existing code style
- Use meaningful variable and function names
- Add proper type annotations
- Use interfaces for object shapes

### General Guidelines

- Write clear, readable code
- Add comments for complex logic
- Keep functions small and focused
- Use meaningful commit messages
- Follow the existing file structure

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run integration tests
npm run test:integration

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write tests for new functionality
- Use descriptive test names
- Test both success and error cases
- Mock external dependencies
- Keep tests focused and isolated

## Documentation

### Code Documentation

- Add JSDoc comments for public functions
- Document complex algorithms
- Include examples in comments
- Keep documentation up to date

### User Documentation

- Update README.md for user-facing changes
- Add examples for new features
- Update CLI help text
- Document breaking changes

## Release Process

### Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

### Creating a Release

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create a git tag
4. Push to GitHub
5. Create a GitHub release

## Getting Help

- **No support is provided or guaranteed.**
- Please do not open issues for questions, bugs, or features.
- If you have a fix or improvement, open a PR.

## Recognition

Contributors will be recognized in:

- The project README
- Release notes
- GitHub contributors page

Thank you for contributing to Pocket to Obsidian! 🎉 