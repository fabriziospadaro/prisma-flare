/**
 * Generates FlareClient interface/class declarations.
 */

export interface FlareClientInterfaceOptions {
  /** Whether to generate an interface (true) or declare class (false) */
  asInterface?: boolean;
  /** The name of the base PrismaClient to extend */
  basePrismaClient?: string;
  /** Whether to export */
  export?: boolean;
}

/**
 * Generates FlareClient interface/class declaration.
 */
export function generateFlareClientInterface(options: FlareClientInterfaceOptions = {}): string {
  const {
    asInterface = false,
    basePrismaClient = 'BasePrismaClient',
    export: shouldExport = true,
  } = options;

  const exportKeyword = shouldExport ? 'export ' : '';
  const keyword = asInterface ? 'interface' : 'declare class';
  const extendsClause = asInterface ? `extends ${basePrismaClient}` : `extends ${basePrismaClient}`;

  return `
// ============================================================================
// FlareClient - Properly typed for your Prisma schema
// ============================================================================

/**
 * FlareClient extends your PrismaClient with the fluent query builder API.
 */
${exportKeyword}${keyword} FlareClient ${extendsClause} {
  constructor(options?: FlareClientOptions);

  /**
   * Creates a new FlareBuilder instance for the specified model.
   * @param modelName - The lowercase model name (e.g., 'user', 'post')
   */
  from<M extends ModelName>(modelName: M): FlareBuilder<M>;

  /**
   * Executes operations within a transaction.
   */
  transaction<R>(
    fn: (tx: FlareClient) => Promise<R>,
    options?: { maxWait?: number; timeout?: number; isolationLevel?: any }
  ): Promise<R>;
}
`.trimStart();
}
