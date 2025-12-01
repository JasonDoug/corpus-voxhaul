// Test helper functions and utilities
import * as fc from 'fast-check';

// Property-based testing generators will be added here as needed

/**
 * Generate a random job ID
 */
export const arbitraryJobId = (): fc.Arbitrary<string> => {
  return fc.uuid();
};

/**
 * Generate a random agent ID
 */
export const arbitraryAgentId = (): fc.Arbitrary<string> => {
  return fc.uuid();
};

/**
 * Generate a random timestamp
 */
export const arbitraryTimestamp = (): fc.Arbitrary<Date> => {
  return fc.date();
};

// Additional generators will be added in subsequent tasks
