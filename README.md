# FreshBooks Time Checker

A basic tool to check FreshBooks time entries for team members.

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

### Usage

#### One Day Query
```bash
# Check time entries for a given day
npm run check-time YYYY-MM-DD
```

#### Date Range Query
```bash
# Check time entries for a date range
npm run check-time YYYY-MM-DD YYYY-MM-DD
```

#### Output Format Options
```bash
# Generate only CSV
npm run check-time 2025-08-28 --csv

# Generate only HTML
npm run check-time 2025-08-28 --html

# Generate both (default)
npm run check-time 2025-08-28
```

## Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run with ts-node for development
- `npm run check-time` - Build and run the time checker

## File Structure

```
node-server/
├── src/
│   ├── index.ts              # Main CLI application
│   ├── config.ts             # Environment configuration
│   ├── types.ts              # TypeScript type definitions
│   ├── freshbooks-api.ts     # FreshBooks API client
│   ├── token-manager.ts      # Access token management
│   ├── report-generator.ts   # Report generation logic
│   └── utils.ts              # Utility functions                     
├── package.json
├── tsconfig.json
├── .env                      # Environment variables
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

The application generates reports in the same format as the original scripts:

- **CSV Reports**: `freshbooks-time-report-YYYY-MM-DD.csv`
- **HTML Reports**: `freshbooks-time-report-YYYY-MM-DD.html`
