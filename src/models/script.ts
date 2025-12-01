// Lecture script models

export interface ScriptBlock {
  id: string;
  text: string;
  contentReference: {
    type: 'text' | 'figure' | 'table' | 'formula' | 'citation';
    id: string;
    pageNumber: number;
  };
  estimatedDuration: number; // seconds
}

export interface ScriptSegment {
  segmentId: string;
  title: string;
  scriptBlocks: ScriptBlock[];
}

export interface LectureScript {
  segments: ScriptSegment[];
  totalEstimatedDuration: number; // seconds
}
