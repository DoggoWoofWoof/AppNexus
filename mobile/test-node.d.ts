// Just the bits of Node that __tests__/clock-change.test.ts uses. The app has no
// Node types, as it never runs in Node, and Node's own clash with React Native's.
// It sits here because Jest takes every file in __tests__ for a test.

declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: string[],
    options: { env: Record<string, string | undefined>; encoding: 'utf8'; timeout: number },
  ): string;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  const path: { join: (...parts: string[]) => string };
  export default path;
}

declare const __dirname: string;
