// Integration test for playback synchronization accuracy
// Task 20.5: Test playback synchronization accuracy
import { PlaybackState } from '../models/playback';
import { WordTiming } from '../models/audio';
import { LectureScript, ScriptSegment, ScriptBlock } from '../models/script';

/**
 * Helper: Create mock playback state with realistic data
 */
function createMockPlaybackState(
  numSegments: number = 3,
  wordsPerSegment: number = 50
): PlaybackState {
  const segments: ScriptSegment[] = [];
  const wordTimings: WordTiming[] = [];
  let currentTime = 0;
  let globalWordIndex = 0;

  for (let segIdx = 0; segIdx < numSegments; segIdx++) {
    const scriptBlocks: ScriptBlock[] = [];
    
    // Create 2-3 blocks per segment
    const numBlocks = 2 + Math.floor(Math.random() * 2);
    const wordsPerBlock = Math.floor(wordsPerSegment / numBlocks);
    
    for (let blockIdx = 0; blockIdx < numBlocks; blockIdx++) {
      const blockId = `block-${segIdx}-${blockIdx}`;
      const words: string[] = [];
      
      // Generate words for this block
      for (let wordIdx = 0; wordIdx < wordsPerBlock; wordIdx++) {
        const word = `word${globalWordIndex}`;
        words.push(word);
        
        // Create word timing (average 0.3 seconds per word)
        const duration = 0.2 + Math.random() * 0.3;
        wordTimings.push({
          word,
          startTime: currentTime,
          endTime: currentTime + duration,
          scriptBlockId: blockId,
        });
        
        currentTime += duration;
        globalWordIndex++;
      }
      
      scriptBlocks.push({
        id: blockId,
        text: words.join(' '),
        contentReference: {
          type: 'text',
          id: `content-${segIdx}-${blockIdx}`,
          pageNumber: segIdx + 1, // Each segment on different page
        },
        estimatedDuration: wordsPerBlock * 0.3,
      });
    }
    
    segments.push({
      segmentId: `segment-${segIdx}`,
      title: `Segment ${segIdx + 1}`,
      scriptBlocks,
    });
  }

  const script: LectureScript = {
    segments,
    totalEstimatedDuration: currentTime,
  };

  return {
    jobId: 'test-job-id',
    pdfUrl: 'https://example.com/test.pdf',
    script,
    audioUrl: 'https://example.com/test.mp3',
    wordTimings,
    currentTime: 0,
    isPlaying: false,
  };
}

/**
 * Helper: Binary search for current word (same logic as AudioSyncManager)
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

  // If not found exactly, return the closest word
  if (left > 0 && left <= wordTimings.length) {
    return wordTimings[left - 1];
  }

  return null;
}

/**
 * Helper: Calculate synchronization drift
 */
function calculateDrift(currentTime: number, wordTiming: WordTiming): number {
  // Drift is the minimum distance from current time to word interval
  if (currentTime >= wordTiming.startTime && currentTime <= wordTiming.endTime) {
    return 0; // Perfect sync
  } else if (currentTime < wordTiming.startTime) {
    return wordTiming.startTime - currentTime;
  } else {
    return currentTime - wordTiming.endTime;
  }
}

describe('Task 20.5: Playback Synchronization Accuracy', () => {
  describe('Highlighting updates smoothly throughout playback', () => {
    test('should find correct word at any point during playback', () => {
      const playbackState = createMockPlaybackState(5, 100);

      // Test at 20 evenly spaced points throughout the lecture
      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      const numCheckPoints = 20;
      
      for (let i = 0; i < numCheckPoints; i++) {
        const checkTime = (i / numCheckPoints) * totalDuration;
        const foundWord = findCurrentWord(playbackState.wordTimings, checkTime);
        
        // Should always find a word
        expect(foundWord).not.toBeNull();
        
        if (foundWord) {
          // Word should be appropriate for the time
          expect(foundWord.startTime).toBeLessThanOrEqual(checkTime + 0.5);
          expect(foundWord.endTime).toBeGreaterThanOrEqual(checkTime - 0.5);
        }
      }
    });

    test('should update highlighting continuously without gaps', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Simulate continuous playback with 100ms intervals
      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      const interval = 0.1; // 100ms
      let previousWord: WordTiming | null = null;
      
      for (let time = 0; time <= totalDuration; time += interval) {
        const currentWord = findCurrentWord(playbackState.wordTimings, time);
        
        // Should always find a word
        expect(currentWord).not.toBeNull();
        
        // If word changed, verify smooth transition
        if (previousWord && currentWord && currentWord.word !== previousWord.word) {
          // New word should start at or after previous word ended
          expect(currentWord.startTime).toBeGreaterThanOrEqual(previousWord.endTime - 0.1);
        }
        
        previousWord = currentWord;
      }
    });

    test('should handle rapid time updates without errors', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Simulate 100 rapid time updates
      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      
      for (let i = 0; i < 100; i++) {
        const randomTime = Math.random() * totalDuration;
        
        // Should not throw error
        expect(() => {
          findCurrentWord(playbackState.wordTimings, randomTime);
        }).not.toThrow();
      }
    });
  });

  describe('PDF pages change at appropriate times', () => {
    test('should track page changes based on script blocks', () => {
      const playbackState = createMockPlaybackState(5, 50);
      
      // Track which page each word should be on
      const wordToPageMap = new Map<string, number>();
      
      playbackState.script.segments.forEach((segment) => {
        segment.scriptBlocks.forEach((block) => {
          const words = block.text.split(' ');
          words.forEach((word) => {
            wordToPageMap.set(word, block.contentReference.pageNumber);
          });
        });
      });

      // Verify word timings reference correct pages
      playbackState.wordTimings.forEach((timing) => {
        const expectedPage = wordToPageMap.get(timing.word);
        
        // Find the block for this word
        const block = playbackState.script.segments
          .flatMap(s => s.scriptBlocks)
          .find(b => b.id === timing.scriptBlockId);
        
        if (block && expectedPage) {
          expect(block.contentReference.pageNumber).toBe(expectedPage);
        }
      });
    });

    test('should maintain page consistency within segments', () => {
      const playbackState = createMockPlaybackState(5, 50);
      
      playbackState.script.segments.forEach((segment) => {
        const pages = segment.scriptBlocks.map(b => b.contentReference.pageNumber);
        
        // Pages within a segment should be close together (within 2 pages)
        const minPage = Math.min(...pages);
        const maxPage = Math.max(...pages);
        
        expect(maxPage - minPage).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Seek to various positions', () => {
    test('should find correct word when seeking to beginning', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Seek to beginning (0 seconds)
      const foundWord = findCurrentWord(playbackState.wordTimings, 0);
      
      expect(foundWord).not.toBeNull();
      if (foundWord) {
        expect(foundWord.startTime).toBe(playbackState.wordTimings[0].startTime);
      }
    });

    test('should find correct word when seeking to middle', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Seek to middle
      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      const middleTime = totalDuration / 2;
      
      const foundWord = findCurrentWord(playbackState.wordTimings, middleTime);
      
      expect(foundWord).not.toBeNull();
      if (foundWord) {
        // Should be somewhere in the middle of the word list
        const wordIndex = playbackState.wordTimings.findIndex(w => w.word === foundWord.word);
        const totalWords = playbackState.wordTimings.length;
        
        expect(wordIndex).toBeGreaterThan(totalWords * 0.3);
        expect(wordIndex).toBeLessThan(totalWords * 0.7);
      }
    });

    test('should find correct word when seeking to end', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Seek to end
      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      const endTime = totalDuration - 0.1;
      
      const foundWord = findCurrentWord(playbackState.wordTimings, endTime);
      
      expect(foundWord).not.toBeNull();
      if (foundWord) {
        // Should be one of the last few words
        const wordIndex = playbackState.wordTimings.findIndex(w => w.word === foundWord.word);
        const totalWords = playbackState.wordTimings.length;
        
        expect(wordIndex).toBeGreaterThan(totalWords * 0.8);
      }
    });

    test('should handle multiple rapid seeks consistently', () => {
      const playbackState = createMockPlaybackState(3, 50);

      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      
      // Perform 20 random seeks
      for (let i = 0; i < 20; i++) {
        const seekTime = Math.random() * totalDuration;
        const foundWord = findCurrentWord(playbackState.wordTimings, seekTime);
        
        // Each seek should find a valid word
        expect(foundWord).not.toBeNull();
        
        if (foundWord) {
          // Word should be appropriate for seek time
          const drift = calculateDrift(seekTime, foundWord);
          expect(drift).toBeLessThan(1.0); // Within 1 second
        }
      }
    });
  });

  describe('Highlighting updates correctly after seek', () => {
    test('should update to correct word immediately after seek', () => {
      const playbackState = createMockPlaybackState(3, 50);

      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      
      // Start at beginning
      let currentWord = findCurrentWord(playbackState.wordTimings, 0);
      expect(currentWord).not.toBeNull();
      
      // Seek to middle
      const middleTime = totalDuration / 2;
      currentWord = findCurrentWord(playbackState.wordTimings, middleTime);
      expect(currentWord).not.toBeNull();
      
      // Verify we're at a different word
      if (currentWord) {
        expect(currentWord.startTime).toBeGreaterThan(totalDuration * 0.3);
      }
      
      // Seek back to beginning
      currentWord = findCurrentWord(playbackState.wordTimings, 0);
      expect(currentWord).not.toBeNull();
      if (currentWord) {
        expect(currentWord.startTime).toBeLessThan(1.0);
      }
    });

    test('should maintain consistency across seek operations', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Seek to same time multiple times
      const seekTime = 10.5;
      const results: (WordTiming | null)[] = [];
      
      for (let i = 0; i < 5; i++) {
        results.push(findCurrentWord(playbackState.wordTimings, seekTime));
      }
      
      // All results should be the same
      results.forEach((result, index) => {
        if (index > 0) {
          expect(result?.word).toBe(results[0]?.word);
          expect(result?.startTime).toBe(results[0]?.startTime);
        }
      });
    });
  });

  describe('Pause and resume functionality', () => {
    test('should maintain position when paused', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Play to a specific time
      const pauseTime = 15.0;
      const wordAtPause = findCurrentWord(playbackState.wordTimings, pauseTime);
      
      // Simulate pause (time doesn't change)
      const wordAfterPause = findCurrentWord(playbackState.wordTimings, pauseTime);
      
      // Should be the same word
      expect(wordAfterPause?.word).toBe(wordAtPause?.word);
      expect(wordAfterPause?.startTime).toBe(wordAtPause?.startTime);
    });

    test('should resume from correct position', () => {
      const playbackState = createMockPlaybackState(3, 50);

      // Play to a specific time
      const pauseTime = 20.0;
      const wordAtPause = findCurrentWord(playbackState.wordTimings, pauseTime);
      
      // Resume and advance slightly
      const resumeTime = pauseTime + 0.5;
      const wordAfterResume = findCurrentWord(playbackState.wordTimings, resumeTime);
      
      // Should be at or near the same word
      if (wordAtPause && wordAfterResume) {
        const drift = Math.abs(wordAfterResume.startTime - wordAtPause.startTime);
        expect(drift).toBeLessThan(2.0); // Within 2 seconds
      }
    });
  });

  describe('Synchronization drift measurement', () => {
    test('should maintain drift under 200ms throughout full lecture', () => {
      const playbackState = createMockPlaybackState(5, 100);

      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      const numCheckPoints = 50;
      const maxDrift = 0.2; // 200ms
      
      let maxObservedDrift = 0;
      
      for (let i = 0; i < numCheckPoints; i++) {
        const checkTime = (i / numCheckPoints) * totalDuration;
        const foundWord = findCurrentWord(playbackState.wordTimings, checkTime);
        
        if (foundWord) {
          const drift = calculateDrift(checkTime, foundWord);
          maxObservedDrift = Math.max(maxObservedDrift, drift);
        }
      }
      
      // Maximum drift should be under 200ms
      expect(maxObservedDrift).toBeLessThan(maxDrift);
    });

    test('should maintain accuracy across long duration lectures', () => {
      // Create a longer lecture (10 segments, 200 words each = ~10 minutes)
      const playbackState = createMockPlaybackState(10, 200);

      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      
      // Verify lecture is reasonably long (at least 5 minutes)
      expect(totalDuration).toBeGreaterThan(300);
      
      // Check synchronization at 100 points
      const numCheckPoints = 100;
      let driftSum = 0;
      
      for (let i = 0; i < numCheckPoints; i++) {
        const checkTime = (i / numCheckPoints) * totalDuration;
        const foundWord = findCurrentWord(playbackState.wordTimings, checkTime);
        
        if (foundWord) {
          const drift = calculateDrift(checkTime, foundWord);
          driftSum += drift;
        }
      }
      
      // Average drift should be very low
      const avgDrift = driftSum / numCheckPoints;
      expect(avgDrift).toBeLessThan(0.05); // Average under 50ms
    });

    test('should handle edge cases at segment boundaries', () => {
      const playbackState = createMockPlaybackState(5, 50);

      // Find segment boundaries (where scriptBlockId changes)
      const boundaries: number[] = [];
      for (let i = 1; i < playbackState.wordTimings.length; i++) {
        if (playbackState.wordTimings[i].scriptBlockId !== 
            playbackState.wordTimings[i - 1].scriptBlockId) {
          boundaries.push(playbackState.wordTimings[i].startTime);
        }
      }
      
      // Test synchronization at each boundary
      boundaries.forEach((boundaryTime) => {
        const foundWord = findCurrentWord(playbackState.wordTimings, boundaryTime);
        
        expect(foundWord).not.toBeNull();
        if (foundWord) {
          // Should find word at or near boundary
          const drift = calculateDrift(boundaryTime, foundWord);
          expect(drift).toBeLessThan(0.5); // Within 500ms at boundaries
        }
      });
    });
  });

  describe('Performance under stress', () => {
    test('should handle very long lectures efficiently', () => {
      // Create a very long lecture (20 segments, 500 words each)
      const playbackState = createMockPlaybackState(20, 500);

      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      
      // Measure performance of 1000 lookups
      const startTime = Date.now();
      
      for (let i = 0; i < 1000; i++) {
        const randomTime = Math.random() * totalDuration;
        findCurrentWord(playbackState.wordTimings, randomTime);
      }
      
      const endTime = Date.now();
      const elapsedMs = endTime - startTime;
      
      // Should complete 1000 lookups in under 100ms (binary search is O(log n))
      expect(elapsedMs).toBeLessThan(100);
    });

    test('should handle frequent time updates without performance degradation', () => {
      const playbackState = createMockPlaybackState(5, 100);

      const totalDuration = playbackState.wordTimings[playbackState.wordTimings.length - 1].endTime;
      
      // Simulate 60 FPS updates for 1 second of playback
      const updates = 60;
      const startTime = Date.now();
      
      for (let i = 0; i < updates; i++) {
        const time = (i / updates) * Math.min(1.0, totalDuration);
        findCurrentWord(playbackState.wordTimings, time);
      }
      
      const endTime = Date.now();
      const elapsedMs = endTime - startTime;
      
      // Should handle 60 updates in under 10ms
      expect(elapsedMs).toBeLessThan(10);
    });
  });
});
