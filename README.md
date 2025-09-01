# FreshBooks Time Checker

A comprehensive tool to check FreshBooks time entries for team members with multiple output formats and OAuth token management.

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env file with your FreshBooks API credentials
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Generate OAuth token (first time setup):**
   ```bash
   npm run check-time generate-token
   ```

## Usage

### One Day Query
```bash
# Check time entries for a given day (generates all formats by default)
npm run check-time 2025-08-28
```

### Date Range Query
```bash
# Check time entries for a date range
npm run check-time 2025-08-28 2025-08-30
```

### Output Format Options
```bash
# Generate only CSV
npm run check-time 2025-08-28 --csv

# Generate only HTML
npm run check-time 2025-08-28 --html

# Generate both formats (default: Excel, PDF)
npm run check-time 2025-08-28
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled JavaScript
- `npm run dev` - Run with ts-node for development
- `npm run check-time` - Build and run the time checker
- `npm run report` - Run with ts-node (development mode)
- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm test` - Run Jest tests

## File Structure

```
node-server/
├── src/
│   ├── index.ts              # Main CLI application with Commander.js
│   ├── config.ts             # Environment configuration
│   ├── types.ts              # TypeScript type definitions
│   ├── freshbooks-api.ts     # FreshBooks API client
│   ├── token-manager.ts      # OAuth access token management
│   ├── report-generator.ts   # Multi-format report generation
│   └── utils.ts              # Utility functions (date calculations, etc.)
├── test/
│   └── utils.test.ts         # Jest unit tests
├── dist/                     # Compiled JavaScript output
├── package.json
├── tsconfig.json
├── jest.config.js            # Jest testing configuration
├── eslint.config.js          # ESLint configuration
├── .env                      # Environment variables
├── .env.example              # Environment template
└── README.md
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `FRESHBOOKS_CLIENT_ID` | FreshBooks OAuth Client ID
| `FRESHBOOKS_CLIENT_SECRET` | FreshBooks OAuth Client Secret
| `FRESHBOOKS_REDIRECT_URI` | OAuth Redirect URI
| `FRESHBOOKS_BUSINESS_ID` | FreshBooks Business ID

## Output Files

The application generates comprehensive reports in multiple formats:
- **Excel Reports**: `freshbooks-time-report-YYYY-MM-DD.xlsx` - Native Excel format with formatting
- **PDF Reports**: `freshbooks-time-report-YYYY-MM-DD.pdf` - Print-ready PDF documents

## Testing

Run the test suite with:
```bash
npm test
```

The project uses Jest for unit testing. Tests are located in the `test/` directory and cover utility functions like date calculations and data processing.


### Development Workflow
```bash
# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev [arguments]

# Run tests
npm test

# Lint code
npm run lint

# Build for production
npm run build
```
