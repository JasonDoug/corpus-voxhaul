// Unit tests for playback interface
import { WordTiming } from '../models/audio';
import { LectureScript, ScriptBlock } from '../models/script';
import { PlaybackState } from '../models/playback';

/**
 * Helper: Binary search for current word (duplicated from implementation)
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
 * Helper: Format time in MM:SS format
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

describe('Playback Interface Unit Tests', () => {
  describe('Audio player initialization', () => {
    test('should handle empty word timings', () => {
      const wordTimings: WordTiming[] = [];
      const result = findCurrentWord(wordTimings, 10);
      expect(result).toBeNull();
    });

    test('should handle single word timing', () => {
      const wordTimings: WordTiming[] = [
        { word: 'hello', startTime: 0, endTime: 1, scriptBlockId: 'block1' },
      ];
      const result = findCurrentWord(wordTimings, 0.5);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('hello');
    });

    test('should format time correctly', () => {
      expect(formatTime(0)).toBe('0:00');
      expect(formatTime(30)).toBe('0:30');
      expect(formatTime(60)).toBe('1:00');
      expect(formatTime(90)).toBe('1:30');
      expect(formatTime(125)).toBe('2:05');
      expect(formatTime(3661)).toBe('61:01');
    });

    test('should handle invalid time values', () => {
      expect(formatTime(NaN)).toBe('0:00');
      expect(formatTime(Infinity)).toBe('0:00');
      expect(formatTime(-Infinity)).toBe('0:00');
    });
  });

  describe('Highlighting updates at specific timestamps', () => {
    const wordTimings: WordTiming[] = [
      { word: 'The', startTime: 0, endTime: 0.5, scriptBlockId: 'block1' },
      { word: 'quick', startTime: 0.5, endTime: 1.0, scriptBlockId: 'block1' },
      { word: 'brown', startTime: 1.0, endTime: 1.5, scriptBlockId: 'block1' },
      { word: 'fox', startTime: 1.5, endTime: 2.0, scriptBlockId: 'block1' },
      { word: 'jumps', startTime: 2.0, endTime: 2.5, scriptBlockId: 'block2' },
    ];

    test('should find word at timestamp 0.25', () => {
      const result = findCurrentWord(wordTimings, 0.25);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('The');
    });

    test('should find word at timestamp 0.75', () => {
      const result = findCurrentWord(wordTimings, 0.75);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('quick');
    });

    test('should find word at timestamp 1.25', () => {
      const result = findCurrentWord(wordTimings, 1.25);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('brown');
    });

    test('should find word at timestamp 2.25', () => {
      const result = findCurrentWord(wordTimings, 2.25);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('jumps');
    });

    test('should handle timestamp at word boundary', () => {
      const result = findCurrentWord(wordTimings, 1.0);
      expect(result).not.toBeNull();
      // Should find either 'quick' or 'brown' at boundary
      expect(['quick', 'brown']).toContain(result?.word);
    });
  });

  describe('Seek to various positions', () => {
    const wordTimings: WordTiming[] = [
      { word: 'First', startTime: 0, endTime: 1, scriptBlockId: 'block1' },
      { word: 'second', startTime: 1, endTime: 2, scriptBlockId: 'block1' },
      { word: 'third', startTime: 2, endTime: 3, scriptBlockId: 'block1' },
      { word: 'fourth', startTime: 3, endTime: 4, scriptBlockId: 'block2' },
      { word: 'fifth', startTime: 4, endTime: 5, scriptBlockId: 'block2' },
    ];

    test('should seek to beginning', () => {
      const result = findCurrentWord(wordTimings, 0);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('First');
    });

    test('should seek to middle', () => {
      const result = findCurrentWord(wordTimings, 2.5);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('third');
    });

    test('should seek to near end', () => {
      const result = findCurrentWord(wordTimings, 4.5);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('fifth');
    });

    test('should seek to exact word start', () => {
      const result = findCurrentWord(wordTimings, 3);
      expect(result).not.toBeNull();
      // At exact boundary, could be either word
      expect(['third', 'fourth']).toContain(result?.word);
    });

    test('should seek to exact word end', () => {
      const result = findCurrentWord(wordTimings, 2);
      expect(result).not.toBeNull();
      expect(['second', 'third']).toContain(result?.word);
    });
  });

  describe('Edge cases (beginning, end of audio)', () => {
    const wordTimings: WordTiming[] = [
      { word: 'Start', startTime: 0, endTime: 1, scriptBlockId: 'block1' },
      { word: 'middle', startTime: 1, endTime: 2, scriptBlockId: 'block1' },
      { word: 'End', startTime: 2, endTime: 3, scriptBlockId: 'block1' },
    ];

    test('should handle time before audio starts', () => {
      const result = findCurrentWord(wordTimings, -1);
      // Should return null or first word
      if (result !== null) {
        expect(result.word).toBe('Start');
      }
    });

    test('should handle time at exact start', () => {
      const result = findCurrentWord(wordTimings, 0);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('Start');
    });

    test('should handle time at exact end', () => {
      const result = findCurrentWord(wordTimings, 3);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('End');
    });

    test('should handle time after audio ends', () => {
      const result = findCurrentWord(wordTimings, 10);
      expect(result).not.toBeNull();
      expect(result?.word).toBe('End');
    });

    test('should handle very small time increments', () => {
      const result1 = findCurrentWord(wordTimings, 0.001);
      const result2 = findCurrentWord(wordTimings, 0.002);
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result1?.word).toBe(result2?.word);
    });
  });

  describe('Script block and page mapping', () => {
    test('should map script blocks to pages correctly', () => {
      const scriptBlock: ScriptBlock = {
        id: 'block1',
        text: 'This is a test block',
        contentReference: {
          type: 'text',
          id: 'content1',
          pageNumber: 5,
        },
        estimatedDuration: 10,
      };

      expect(scriptBlock.contentReference.pageNumber).toBe(5);
    });

    test('should handle multiple blocks with different pages', () => {
      const blocks: ScriptBlock[] = [
        {
          id: 'block1',
          text: 'Block 1',
          contentReference: { type: 'text', id: 'c1', pageNumber: 1 },
          estimatedDuration: 5,
        },
        {
          id: 'block2',
          text: 'Block 2',
          contentReference: { type: 'figure', id: 'c2', pageNumber: 2 },
          estimatedDuration: 5,
        },
        {
          id: 'block3',
          text: 'Block 3',
          contentReference: { type: 'table', id: 'c3', pageNumber: 3 },
          estimatedDuration: 5,
        },
      ];

      expect(blocks[0].contentReference.pageNumber).toBe(1);
      expect(blocks[1].contentReference.pageNumber).toBe(2);
      expect(blocks[2].contentReference.pageNumber).toBe(3);
    });
  });

  describe('Playback state management', () => {
    test('should initialize playback state correctly', () => {
      const script: LectureScript = {
        segments: [
          {
            segmentId: 'seg1',
            title: 'Introduction',
            scriptBlocks: [
              {
                id: 'block1',
                text: 'Welcome',
                contentReference: { type: 'text', id: 'c1', pageNumber: 1 },
                estimatedDuration: 5,
              },
            ],
          },
        ],
        totalEstimatedDuration: 5,
      };

      const playbackState: PlaybackState = {
        jobId: 'job123',
        pdfUrl: 'https://example.com/pdf.pdf',
        script: script,
        audioUrl: 'https://example.com/audio.mp3',
        wordTimings: [],
        currentTime: 0,
        isPlaying: false,
      };

      expect(playbackState.jobId).toBe('job123');
      expect(playbackState.currentTime).toBe(0);
      expect(playbackState.isPlaying).toBe(false);
      expect(playbackState.script.segments).toHaveLength(1);
    });

    test('should handle playback state transitions', () => {
      const state: PlaybackState = {
        jobId: 'job123',
        pdfUrl: 'https://example.com/pdf.pdf',
        script: {
          segments: [],
          totalEstimatedDuration: 100,
        },
        audioUrl: 'https://example.com/audio.mp3',
        wordTimings: [],
        currentTime: 0,
        isPlaying: false,
      };

      // Simulate play
      state.isPlaying = true;
      expect(state.isPlaying).toBe(true);

      // Simulate time update
      state.currentTime = 10;
      expect(state.currentTime).toBe(10);

      // Simulate pause
      state.isPlaying = false;
      expect(state.isPlaying).toBe(false);

      // Simulate seek
      state.currentTime = 50;
      expect(state.currentTime).toBe(50);
    });
  });

  describe('Binary search performance', () => {
    test('should handle large word timing arrays efficiently', () => {
      // Create a large array of word timings
      const wordTimings: WordTiming[] = [];
      for (let i = 0; i < 10000; i++) {
        wordTimings.push({
          word: `word${i}`,
          startTime: i,
          endTime: i + 1,
          scriptBlockId: `block${Math.floor(i / 100)}`,
        });
      }

      const startTime = Date.now();
      const result = findCurrentWord(wordTimings, 5000.5);
      const endTime = Date.now();

      expect(result).not.toBeNull();
      expect(result?.word).toBe('word5000');
      
      // Binary search should be very fast even with 10k items
      expect(endTime - startTime).toBeLessThan(10); // Less than 10ms
    });
  });

  describe('Word timing validation', () => {
    test('should handle overlapping word timings gracefully', () => {
      const wordTimings: WordTiming[] = [
        { word: 'First', startTime: 0, endTime: 2, scriptBlockId: 'block1' },
        { word: 'Second', startTime: 1, endTime: 3, scriptBlockId: 'block1' },
      ];

      // At time 1.5, both words overlap
      const result = findCurrentWord(wordTimings, 1.5);
      expect(result).not.toBeNull();
      // Should find one of the overlapping words
      expect(['First', 'Second']).toContain(result?.word);
    });

    test('should handle gaps in word timings', () => {
      const wordTimings: WordTiming[] = [
        { word: 'First', startTime: 0, endTime: 1, scriptBlockId: 'block1' },
        { word: 'Second', startTime: 3, endTime: 4, scriptBlockId: 'block1' },
      ];

      // At time 2, there's a gap
      const result = findCurrentWord(wordTimings, 2);
      expect(result).not.toBeNull();
      // Should return the closest word (First)
      expect(result?.word).toBe('First');
    });

    test('should handle zero-duration words', () => {
      const wordTimings: WordTiming[] = [
        { word: 'Instant', startTime: 1, endTime: 1, scriptBlockId: 'block1' },
        { word: 'Normal', startTime: 1, endTime: 2, scriptBlockId: 'block1' },
      ];

      const result = findCurrentWord(wordTimings, 1);
      expect(result).not.toBeNull();
    });
  });
});
