/** DI token for the shared connector registry. Kept in its own file so the
 * module and the controller can both import it without a circular dependency. */
export const CONNECTOR_REGISTRY = "CONNECTOR_REGISTRY";
