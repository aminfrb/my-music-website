// Ambient declaration so side-effect stylesheet imports (e.g. `import "./globals.css";`)
// type-check cleanly. Without this, TypeScript reports:
//   Cannot find module or type declarations for side-effect import of './globals.css'. ts(2882)
declare module "*.css";
