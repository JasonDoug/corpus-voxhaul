// Content extraction and segmentation models

export interface ElementReference {
  type: 'figure' | 'table' | 'formula' | 'citation';
  id: string;
}

export interface PageContent {
  pageNumber: number;
  text: string;
  elements: ElementReference[];
}

export interface Figure {
  id: string;
  pageNumber: number;
  imageData: string;
  description: string;
  caption?: string;
}

export interface Table {
  id: string;
  pageNumber: number;
  headers: string[];
  rows: string[][];
  interpretation: string;
}

export interface Formula {
  id: string;
  pageNumber: number;
  latex: string;
  explanation: string;
}

export interface Citation {
  id: string;
  text: string;
  authors?: string[];
  year?: number;
  title?: string;
}

export interface ExtractedContent {
  pages: PageContent[];
  figures: Figure[];
  tables: Table[];
  formulas: Formula[];
  citations: Citation[];
}

export interface ContentBlock {
  type: 'text' | 'figure' | 'table' | 'formula' | 'citation';
  content: string | Figure | Table | Formula | Citation;
  pageReference: number;
}

export interface ContentSegment {
  id: string;
  title: string;
  order: number;
  contentBlocks: ContentBlock[];
  prerequisites: string[];
}

export interface SegmentedContent {
  segments: ContentSegment[];
}
