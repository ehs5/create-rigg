export const PKG_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;
export type PkgManager = (typeof PKG_MANAGERS)[number];
