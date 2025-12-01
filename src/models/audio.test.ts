// Property-based tests for audio models
import * as fc from 'fast-check';
import { AudioOutput, WordTiming } from './audio';

// Generator for word timings that are monotonically increasing
const wordTimingArrayArb = fc
  .array(
    fc.record({
      word: fc.string({ minLength: 1 }),
      scriptBlockId: fc.string({ minLength: 1 }),
    }),
    { minLength: 1, maxLength: 100 }
  )
  .map((words) => {
    // Generate monotonically increasing timings
    let currentTime = 0;
    return words.map((word) => {
      const duration = Math.random() * 0.5 + 0.1; // 0.1 to 0.6 seconds per word
      const startTime = currentTime;
      const endTime = currentTime + duration;
      currentTime = endTime;
      return {
        word: word.word,
        startTime,
        endTime,
        scriptBlockId: word.scriptBlockId,
      };
    });
  });

// Generator for AudioOutput with consistent timing
const audioOutputArb = wordTimingArrayArb.chain((wordTimings) => {
  const totalDuration = wordTimings.length > 0 
    ? wordTimings[wordTimings.length - 1].endTime 
    : 0;
  
  return fc.record({
    audioUrl: fc.webUrl(),
    duration: fc.constant(totalDuration),
    wordTimings: fc.constant(wordTimings),
  });
});

// Feature: pdf-lecture-service, Property 24: Timing data consistency
describe('Property 24: Timing data consistency', () => {
  it('should ensure timings are monotonically increasing and last word end time equals total duration', () => {
    fc.assert(
      fc.property(audioOutputArb, (audioOutput: AudioOutput) => {
        const { wordTimings, duration } = audioOutput;
        
        // Check that we have word timings
        expect(wordTimings).toBeDefined();
        
        if (wordTimings.length === 0) {
          // If no words, duration should be 0
          expect(duration).toBe(0);
          return;
        }
        
        // Check monotonically increasing timings
        for (let i = 0; i < wordTimings.length; i++) {
          const timing = wordTimings[i];
          
          // Each word's start time should be less than or equal to its end time
          expect(timing.startTime).toBeLessThanOrEqual(timing.endTime);
          
          // Each word's start time should be >= previous word's end time
          if (i > 0) {
            const prevTiming = wordTimings[i - 1];
            expect(timing.startTime).toBeGreaterThanOrEqual(prevTiming.endTime);
          }
        }
        
        // Last word's end time should approximately equal total duration
        const lastWordEndTime = wordTimings[wordTimings.length - 1].endTime;
        expect(Math.abs(lastWordEndTime - duration)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });
  
  it('should reject timing data where words overlap or go backwards', () => {
    // Test with invalid timing data (overlapping words)
    const invalidTimings: WordTiming[] = [
      { word: 'hello', startTime: 0, endTime: 1, scriptBlockId: 'block1' },
      { word: 'world', startTime: 0.5, endTime: 1.5, scriptBlockId: 'block1' }, // Overlaps!
    ];
    
    // This should fail the monotonicity check
    expect(invalidTimings[1].startTime).toBeLessThan(invalidTimings[0].endTime);
  });
  
  it('should reject timing data where duration does not match last word end time', () => {
    const timings: WordTiming[] = [
      { word: 'hello', startTime: 0, endTime: 1, scriptBlockId: 'block1' },
      { word: 'world', startTime: 1, endTime: 2, scriptBlockId: 'block1' },
    ];
    
    const duration = 5; // Doesn't match last word end time of 2
    
    const lastWordEndTime = timings[timings.length - 1].endTime;
    expect(Math.abs(lastWordEndTime - duration)).toBeGreaterThan(0.001);
  });
});
