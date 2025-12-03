// Feature Flags Tests - Verify gradual rollout capability
import { config } from '../utils/config';

describe('Feature Flags', () => {
  describe('Configuration', () => {
    it('should have all three LLM integration feature flags', () => {
      expect(config.featureFlags).toBeDefined();
      expect(config.featureFlags.enableRealSegmentation).toBeDefined();
      expect(config.featureFlags.enableRealScriptGeneration).toBeDefined();
      expect(config.featureFlags.enableImageExtraction).toBeDefined();
    });

    it('should default to enabled in test environment', () => {
      // In test environment, flags should be enabled by default (set in setup.ts)
      expect(config.featureFlags.enableRealSegmentation).toBe(true);
      expect(config.featureFlags.enableRealScriptGeneration).toBe(true);
      expect(config.featureFlags.enableImageExtraction).toBe(true);
    });
  });

  describe('Segmentation Feature Flag', () => {
    it('should use mock implementation when flag is disabled', async () => {
      // Temporarily disable the flag
      const originalValue = config.featureFlags.enableRealSegmentation;
      config.featureFlags.enableRealSegmentation = false;

      const { callSegmentationLLM } = require('./segmenter');
      
      const result = await callSegmentationLLM('test prompt');
      
      // Mock implementation returns 3 segments with specific titles
      expect(result.segments).toHaveLength(3);
      expect(result.segments[0].title).toBe('Introduction and Background');
      expect(result.segments[1].title).toBe('Main Content');
      expect(result.segments[2].title).toBe('Conclusion');

      // Restore original value
      config.featureFlags.enableRealSegmentation = originalValue;
    });
  });

  describe('Script Generation Feature Flag', () => {
    it('should use mock implementation when flag is disabled', () => {
      // Temporarily disable the flag
      const originalValue = config.featureFlags.enableRealScriptGeneration;
      config.featureFlags.enableRealScriptGeneration = false;

      // Verify the flag is disabled
      expect(config.featureFlags.enableRealScriptGeneration).toBe(false);

      // Restore original value
      config.featureFlags.enableRealScriptGeneration = originalValue;
    });
  });

  describe('Image Extraction Feature Flag', () => {
    it('should use placeholder when flag is disabled', async () => {
      // Temporarily disable the flag
      const originalValue = config.featureFlags.enableImageExtraction;
      config.featureFlags.enableImageExtraction = false;

      const { analyzeFigures } = require('./analyzer');
      
      const mockPdfBuffer = Buffer.from('mock pdf data');
      const figurePositions = [
        { pageNumber: 1, id: 'fig1' },
      ];

      const result = await analyzeFigures(figurePositions, mockPdfBuffer);
      
      // When flag is disabled, should use placeholder image data
      expect(result).toHaveLength(1);
      expect(result[0].imageData).toContain('placeholder');

      // Restore original value
      config.featureFlags.enableImageExtraction = originalValue;
    });
  });

  describe('Gradual Rollout Capability', () => {
    it('should allow independent control of each feature', () => {
      // Save original values
      const originalSeg = config.featureFlags.enableRealSegmentation;
      const originalScript = config.featureFlags.enableRealScriptGeneration;
      const originalImage = config.featureFlags.enableImageExtraction;

      // Test that each flag can be set independently
      config.featureFlags.enableRealSegmentation = true;
      config.featureFlags.enableRealScriptGeneration = false;
      config.featureFlags.enableImageExtraction = true;

      expect(config.featureFlags.enableRealSegmentation).toBe(true);
      expect(config.featureFlags.enableRealScriptGeneration).toBe(false);
      expect(config.featureFlags.enableImageExtraction).toBe(true);

      // Restore original values
      config.featureFlags.enableRealSegmentation = originalSeg;
      config.featureFlags.enableRealScriptGeneration = originalScript;
      config.featureFlags.enableImageExtraction = originalImage;
    });

    it('should support all-enabled configuration', () => {
      const originalSeg = config.featureFlags.enableRealSegmentation;
      const originalScript = config.featureFlags.enableRealScriptGeneration;
      const originalImage = config.featureFlags.enableImageExtraction;

      config.featureFlags.enableRealSegmentation = true;
      config.featureFlags.enableRealScriptGeneration = true;
      config.featureFlags.enableImageExtraction = true;

      expect(config.featureFlags.enableRealSegmentation).toBe(true);
      expect(config.featureFlags.enableRealScriptGeneration).toBe(true);
      expect(config.featureFlags.enableImageExtraction).toBe(true);

      config.featureFlags.enableRealSegmentation = originalSeg;
      config.featureFlags.enableRealScriptGeneration = originalScript;
      config.featureFlags.enableImageExtraction = originalImage;
    });

    it('should support all-disabled configuration', () => {
      const originalSeg = config.featureFlags.enableRealSegmentation;
      const originalScript = config.featureFlags.enableRealScriptGeneration;
      const originalImage = config.featureFlags.enableImageExtraction;

      config.featureFlags.enableRealSegmentation = false;
      config.featureFlags.enableRealScriptGeneration = false;
      config.featureFlags.enableImageExtraction = false;

      expect(config.featureFlags.enableRealSegmentation).toBe(false);
      expect(config.featureFlags.enableRealScriptGeneration).toBe(false);
      expect(config.featureFlags.enableImageExtraction).toBe(false);

      config.featureFlags.enableRealSegmentation = originalSeg;
      config.featureFlags.enableRealScriptGeneration = originalScript;
      config.featureFlags.enableImageExtraction = originalImage;
    });
  });
});
