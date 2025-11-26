/**
 * Test Helper Functions
 * Utilities for creating mock objects in tests
 */
/**
 * Creates a partial mock SillyTavern context for testing
 * This allows tests to only specify the properties they need
 */
export declare function createMockContext(partial?: Partial<SillyTavernContext>): SillyTavernContext;
