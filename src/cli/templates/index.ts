/**
 * Template generators for prisma-flare client generation.
 *
 * These templates are used to generate type-safe FlareClient wrappers
 * that use the user's actual Prisma types instead of prisma-flare's bundled types.
 */

export { generateTypeHelpers } from './type-helpers';
export { generateFlareBuilderInterface, FLARE_BUILDER_METHODS } from './flare-builder-interface';
export { generateFlareClientInterface } from './flare-client-interface';
