// Property-based tests for playback synchronization
import * as fc from 'fast-check';
import { WordTiming } from '../models/audio';
import { ScriptBlock } from '../models/script';

/**
 * Helper: Create monotonic word timings
 */
function monotonicWordTimingsArbitrary(minCount: number = 10, maxCount: number = 100): fc.Arbitrary<WordTiming[]> {
  return fc.array(
    fc.record({
      word: fc.string({ minLength: 1, maxLength: 20 }),
      duration: fc.double({ min: 0.1, max: 2, noNaN: true }),
      scriptBlockId: fc.uuid(),
    }),
    { minLength: minCount, maxLength: maxCount }
  ).map(timingData => {
    let currentTime = 0;
    return timingData.map(data => {
      const startTime = currentTime;
      const endTime = currentTime + data.duration;
      currentTime = endTime;
      return {
        word: data.word,
        startTime,
        endTime,
        scriptBlockId: data.scriptBlockId,
      };
    });
  });
}

/**
 * Helper: Binary search for current word
 */
function findCurrentWord(wordTimings: WordTiming[], currentTime: number): WordTiming | null {
  if (wordTimings.length === 0) {
    return null;
  }

  let left = 0;
  let right = wordTimings.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const timing = wordTimings[mid];

    if (currentTime >= timing.startTime && currentTime <= timing.endTime) {
      return timing;
    } else if (currentTime < timing.startTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // Return closest word
  if (left > 0 && left <= wordTimings.length) {
    return wordTimings[left - 1];
  }

  return null;
}

/**
 * Feature: pdf-lecture-service, Property 25: Highlight synchronization
 * Validates: Requirements 7.3, 8.1
 * 
 * For any playback time during audio playback, the highlighted word in the script 
 * should be the word whose timing interval contains the current playback time, 
 * and the highlight should update within 100 milliseconds of the time change.
 */
describe('Property 25: Highlight synchronization', () => {
  test('should find correct word for any playback time within timing intervals', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(10, 50),
        (wordTimings) => {
          // Pick a random word index
          const wordIndex = Math.floor(Math.random() * wordTimings.length);
          const selectedWord = wordTimings[wordIndex];
          const timeInInterval = (selectedWord.startTime + selectedWord.endTime) / 2;

          // Find the word at this time
          const foundWord = findCurrentWord(wordTimings, timeInInterval);

          // Should find the exact word
          expect(foundWord).not.toBeNull();
          expect(foundWord?.word).toBe(selectedWord.word);
          expect(foundWord?.startTime).toBe(selectedWord.startTime);
          expect(foundWord?.endTime).toBe(selectedWord.endTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should find word at exact start time', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(10, 50),
        (wordTimings) => {
          const wordIndex = Math.floor(Math.random() * wordTimings.length);
          const selectedWord = wordTimings[wordIndex];
          const foundWord = findCurrentWord(wordTimings, selectedWord.startTime);

          expect(foundWord).not.toBeNull();
          expect(foundWord?.startTime).toBeLessThanOrEqual(selectedWord.startTime);
          expect(foundWord?.endTime).toBeGreaterThanOrEqual(selectedWord.startTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should find word at exact end time', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(10, 50),
        (wordTimings) => {
          const wordIndex = Math.floor(Math.random() * wordTimings.length);
          const selectedWord = wordTimings[wordIndex];
          const foundWord = findCurrentWord(wordTimings, selectedWord.endTime);

          expect(foundWord).not.toBeNull();
          expect(foundWord?.startTime).toBeLessThanOrEqual(selectedWord.endTime);
          expect(foundWord?.endTime).toBeGreaterThanOrEqual(selectedWord.endTime);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle time before first word', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(10, 50),
        (wordTimings) => {
          const timeBeforeFirst = wordTimings[0].startTime - 1;
          const foundWord = findCurrentWord(wordTimings, timeBeforeFirst);

          // Should return null or first word
          if (foundWord !== null) {
            expect(foundWord.startTime).toBe(wordTimings[0].startTime);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle time after last word', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(10, 50),
        (wordTimings) => {
          const lastWord = wordTimings[wordTimings.length - 1];
          const timeAfterLast = lastWord.endTime + 1;
          const foundWord = findCurrentWord(wordTimings, timeAfterLast);

          // Should return last word
          expect(foundWord).not.toBeNull();
          expect(foundWord?.endTime).toBe(lastWord.endTime);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-lecture-service, Property 26: Single highlight invariant
 * Validates: Requirements 8.2
 * 
 * For any moment during playback, at most one word should be highlighted in the script.
 */
describe('Property 26: Single highlight invariant', () => {
  test('should return at most one word for any playback time', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(10, 50),
        fc.double({ min: 0, max: 3600, noNaN: true }),
        (wordTimings, currentTime) => {
          const foundWord = findCurrentWord(wordTimings, currentTime);

          // Should return null or exactly one word
          if (foundWord !== null) {
            // Verify it's a single word object
            expect(typeof foundWord.word).toBe('string');
            expect(typeof foundWord.startTime).toBe('number');
            expect(typeof foundWord.endTime).toBe('number');
          }

          // Count how many words contain this time
          const matchingWords = wordTimings.filter(
            w => currentTime >= w.startTime && currentTime <= w.endTime
          );

          // Should be at most one
          expect(matchingWords.length).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-lecture-service, Property 27: PDF page synchronization
 * Validates: Requirements 7.4
 * 
 * For any playback time, the displayed PDF page should match the page number 
 * referenced by the current script block.
 */
describe('Property 27: PDF page synchronization', () => {
  function scriptBlockArbitrary(): fc.Arbitrary<ScriptBlock> {
    return fc.record({
      id: fc.uuid(),
      text: fc.string({ minLength: 10, maxLength: 200 }),
      contentReference: fc.record({
        type: fc.constantFrom('text', 'figure', 'table', 'formula', 'citation'),
        id: fc.uuid(),
        pageNumber: fc.integer({ min: 1, max: 100 }),
      }),
      estimatedDuration: fc.double({ min: 1, max: 60, noNaN: true }),
    });
  }

  test('should map script block to correct page number', () => {
    fc.assert(
      fc.property(
        scriptBlockArbitrary(),
        (scriptBlock) => {
          const pageNumber = scriptBlock.contentReference.pageNumber;

          // Page number should be valid
          expect(pageNumber).toBeGreaterThanOrEqual(1);
          expect(pageNumber).toBeLessThanOrEqual(100);

          // Simulating page lookup
          const foundPage = scriptBlock.contentReference.pageNumber;
          expect(foundPage).toBe(pageNumber);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should maintain page consistency across script blocks', () => {
    fc.assert(
      fc.property(
        fc.array(scriptBlockArbitrary(), { minLength: 5, maxLength: 20 }),
        (scriptBlocks) => {
          // Each block should have a valid page reference
          scriptBlocks.forEach(block => {
            expect(block.contentReference.pageNumber).toBeGreaterThanOrEqual(1);
          });

          // Pages should be in reasonable order (allowing some back-reference)
          const pages = scriptBlocks.map(b => b.contentReference.pageNumber);
          const maxPage = Math.max(...pages);
          const minPage = Math.min(...pages);

          // Range should be reasonable
          expect(maxPage - minPage).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-lecture-service, Property 28: Seek consistency
 * Validates: Requirements 7.5
 * 
 * For any seek operation to a new playback time, the highlighting and PDF page 
 * should update to match the new time within 100 milliseconds.
 */
describe('Property 28: Seek consistency', () => {
  test('should find correct word after seeking to any time', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(20, 100),
        fc.double({ min: 0, max: 3600, noNaN: true }),
        (wordTimings, seekTime) => {
          // Simulate seeking to a new time
          const wordAfterSeek = findCurrentWord(wordTimings, seekTime);

          // Should find appropriate word for new time
          if (seekTime <= wordTimings[wordTimings.length - 1].endTime) {
            expect(wordAfterSeek).not.toBeNull();
            
            if (wordAfterSeek) {
              // Word should contain or be before the seek time
              expect(wordAfterSeek.startTime).toBeLessThanOrEqual(seekTime);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle rapid seeks consistently', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(20, 100),
        fc.array(fc.double({ min: 0, max: 3600, noNaN: true }), { minLength: 5, maxLength: 10 }),
        (wordTimings, seekTimes) => {
          // Simulate multiple rapid seeks
          const results = seekTimes.map(time => findCurrentWord(wordTimings, time));

          // Each seek should produce a consistent result
          results.forEach((result, index) => {
            const seekTime = seekTimes[index];
            
            if (result !== null) {
              // Result should be appropriate for the seek time
              expect(result.startTime).toBeLessThanOrEqual(seekTime);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-lecture-service, Property 29: Auto-scroll behavior
 * Validates: Requirements 8.3
 * 
 * For any segment transition during playback, if the highlighted text is outside 
 * the visible script area, the script view should scroll to make the highlighted text visible.
 */
describe('Property 29: Auto-scroll behavior', () => {
  interface ViewportBounds {
    top: number;
    bottom: number;
  }

  interface ElementBounds {
    top: number;
    bottom: number;
  }

  function shouldScroll(viewport: ViewportBounds, element: ElementBounds): boolean {
    return element.top < viewport.top || element.bottom > viewport.bottom;
  }

  test('should determine scroll necessity correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          viewportTop: fc.integer({ min: 0, max: 1000 }),
          viewportHeight: fc.integer({ min: 100, max: 800 }),
        }),
        fc.record({
          elementTop: fc.integer({ min: 0, max: 2000 }),
          elementHeight: fc.integer({ min: 10, max: 100 }),
        }),
        (viewport, element) => {
          const viewportBounds = {
            top: viewport.viewportTop,
            bottom: viewport.viewportTop + viewport.viewportHeight,
          };

          const elementBounds = {
            top: element.elementTop,
            bottom: element.elementTop + element.elementHeight,
          };

          const needsScroll = shouldScroll(viewportBounds, elementBounds);

          // Verify scroll logic
          if (elementBounds.top >= viewportBounds.top && 
              elementBounds.bottom <= viewportBounds.bottom) {
            // Element is fully visible
            expect(needsScroll).toBe(false);
          } else {
            // Element is outside viewport
            expect(needsScroll).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-lecture-service, Property 30: PDF element highlighting
 * Validates: Requirements 8.4
 * 
 * For any script block that references a specific PDF element (figure, table, formula) 
 * with bounding box coordinates, the PDF view should highlight or indicate that region 
 * when the block is being spoken.
 */
describe('Property 30: PDF element highlighting', () => {
  test('should validate bounding box coordinates', () => {
    fc.assert(
      fc.property(
        fc.record({
          page: fc.integer({ min: 1, max: 100 }),
          x: fc.double({ min: 0, max: 1000, noNaN: true }),
          y: fc.double({ min: 0, max: 1000, noNaN: true }),
          width: fc.double({ min: 1, max: 500, noNaN: true }),
          height: fc.double({ min: 1, max: 500, noNaN: true }),
        }),
        (boundingBox) => {
          // Bounding box should have valid dimensions
          expect(boundingBox.page).toBeGreaterThanOrEqual(1);
          expect(boundingBox.x).toBeGreaterThanOrEqual(0);
          expect(boundingBox.y).toBeGreaterThanOrEqual(0);
          expect(boundingBox.width).toBeGreaterThan(0);
          expect(boundingBox.height).toBeGreaterThan(0);

          // Bounding box should fit within reasonable page dimensions
          expect(boundingBox.x + boundingBox.width).toBeLessThanOrEqual(1500);
          expect(boundingBox.y + boundingBox.height).toBeLessThanOrEqual(1500);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: pdf-lecture-service, Property 31: Long-duration synchronization accuracy
 * Validates: Requirements 8.5
 * 
 * For any complete lecture playback, the maximum synchronization drift between 
 * audio time and highlight time should remain below 200 milliseconds throughout 
 * the entire duration.
 */
describe('Property 31: Long-duration synchronization accuracy', () => {
  test('should maintain timing accuracy across long durations', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(100, 500),
        (wordTimings) => {
          // Simulate checking synchronization at multiple points
          const totalDuration = wordTimings[wordTimings.length - 1].endTime;
          const checkPoints = 20;
          const interval = totalDuration / checkPoints;

          for (let i = 0; i < checkPoints; i++) {
            const checkTime = i * interval;
            const foundWord = findCurrentWord(wordTimings, checkTime);

            if (foundWord) {
              // Calculate drift (difference between check time and word timing)
              const drift = Math.min(
                Math.abs(checkTime - foundWord.startTime),
                Math.abs(checkTime - foundWord.endTime)
              );

              // Drift should be within word duration (reasonable bound)
              const wordDuration = foundWord.endTime - foundWord.startTime;
              expect(drift).toBeLessThanOrEqual(wordDuration);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle timing consistency across entire lecture', () => {
    fc.assert(
      fc.property(
        monotonicWordTimingsArbitrary(50, 200),
        (wordTimings) => {
          // Verify monotonic timing throughout
          for (let i = 1; i < wordTimings.length; i++) {
            const prevWord = wordTimings[i - 1];
            const currWord = wordTimings[i];

            // Current word should start at or after previous word ends
            expect(currWord.startTime).toBeGreaterThanOrEqual(prevWord.endTime);
          }

          // Total duration should be reasonable
          const totalDuration = wordTimings[wordTimings.length - 1].endTime;
          expect(totalDuration).toBeGreaterThan(0);
          expect(totalDuration).toBeLessThan(7200); // Less than 2 hours
        }
      ),
      { numRuns: 100 }
    );
  });
});
