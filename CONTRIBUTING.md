# Contributing

Thanks for your interest in contributing! This guide covers how to set up the project, make changes, and submit pull requests.

## Getting Started

1. Fork the repository on GitHub: [Satyam12x/req-log](https://github.com/Satyam12x/req-log)
2. Clone your fork and install dependencies:
   ```bash
   git clone https://github.com/<your-username>/req-log.git
   cd req-log
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Run tests:
   ```bash
   npm test
   ```

## Development Workflow

### Project Structure

```
src/
├── index.ts            # Main middleware entry point
├── types.ts            # TypeScript type definitions
├── formatters/         # Log format implementations
│   ├── default.ts      # Colored human-readable format
│   └── json.ts         # Structured JSON format
├── transports/         # Log destination implementations
│   ├── console.ts      # Writes to stdout
│   └── file.ts         # Writes to file via buffered streams
└── utils/              # Shared utilities
    ├── colors.ts       # ANSI color helpers
    ├── sanitize.ts     # Redaction and safe serialization
    └── timer.ts        # High-resolution timing
```

### Running the Example Server

```bash
npm run build
node example/server.js
```

Then make requests:

```bash
curl http://localhost:3000/
curl http://localhost:3000/users
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'
```

### Running Tests

```bash
npm test              # run once
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

## Submitting Changes

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Add tests for any new behavior
3. Ensure tests and build both pass: `npm test && npm run build`
4. Commit with a descriptive message (see below)
5. Open a pull request

### Commit Message Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation changes
- `refactor:` code changes that neither fix a bug nor add a feature
- `test:` adding or fixing tests
- `chore:` maintenance tasks

Example: `feat: add request ID tracking`

## Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/Satyam12x/req-log/issues) with:

- A clear description
- Steps to reproduce (for bugs)
- Expected vs. actual behavior (for bugs)
- Use case (for features)

## Code of Conduct

Be respectful. Be constructive. Assume good intent.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
