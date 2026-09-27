import { register } from "tsx/cjs/api";

// The container `require`s application modules by path, outside vitest's
// transform, so a CommonJS hook that understands TypeScript has to be in place
// before the server is composed.
register();
