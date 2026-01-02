# Examples

This folder contains standalone example projects demonstrating lit-ui-router usage.

## StackBlitz Integration

Each example is a self-contained Vite + TypeScript project designed to run directly on [StackBlitz](https://stackblitz.com/). You can open any example in StackBlitz using the GitHub integration:

```
https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/<example-name>
```

See [StackBlitz Tips & Best Practices](https://developer.stackblitz.com/guides/integration/open-from-github#tips-best-practices)

### Available Examples

| Example              | Description                                  | StackBlitz                                                                                         |
| -------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **helloworld**       | Basic routing with two states and navigation | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/helloworld)       |
| **hellosolarsystem** | Route parameters and resolve data            | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellosolarsystem) |
| **hellogalaxy**      | Nested states with nested views              | [Open](https://stackblitz.com/github/simshanith/lit-ui-router/tree/main/examples/hellogalaxy)      |

## Running Locally

To run an example locally:

```bash
cd examples/<example-name>
npm install
npm run dev
```

## Project Structure

Each example follows the same structure:

```
<example-name>/
├── index.html          # Entry HTML file
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vite.config.ts      # Vite configuration
└── src/
    └── main.ts         # Application entry point
```
