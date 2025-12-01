// Playback interface models

import { LectureScript } from './script';
import { WordTiming } from './audio';

export interface BoundingBox {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HighlightState {
  currentWord: string;
  currentScriptBlockId: string;
  currentPageNumber: number;
  highlightPosition: {
    scriptOffset: number;
    pdfRegion?: BoundingBox;
  };
}

export interface PlaybackState {
  jobId: string;
  pdfUrl: string;
  script: LectureScript;
  audioUrl: string;
  wordTimings: WordTiming[];
  currentTime: number;
  isPlaying: boolean;
}
