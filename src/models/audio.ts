// Audio synthesis models

export interface WordTiming {
  word: string;
  startTime: number; // seconds
  endTime: number; // seconds
  scriptBlockId: string;
}

export interface AudioOutput {
  audioUrl: string;
  duration: number; // seconds
  wordTimings: WordTiming[];
}
