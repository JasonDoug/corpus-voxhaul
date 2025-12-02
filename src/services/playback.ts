// Playback service for Immersive Reader
import { PlaybackState, HighlightState, BoundingBox } from '../models/playback';
import { WordTiming } from '../models/audio';
import { ScriptBlock } from '../models/script';

/**
 * PDF Viewer Manager
 * Handles PDF rendering, page navigation, and region highlighting
 */
export class PDFViewerManager {
  private pdfDoc: any = null;
  private currentPage: number = 1;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private highlightLayer: HTMLElement;
  private scale: number = 1.5;

  constructor(canvas: HTMLCanvasElement, highlightLayer: HTMLElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.context = ctx;
    this.highlightLayer = highlightLayer;
  }

  /**
   * Load PDF from URL
   */
  async loadPDF(pdfUrl: string): Promise<void> {
    // @ts-ignore - PDF.js global
    const pdfjsLib = window.pdfjsLib;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    this.pdfDoc = await loadingTask.promise;
    await this.renderPage(1);
  }

  /**
   * Render a specific page
   */
  async renderPage(pageNumber: number): Promise<void> {
    if (!this.pdfDoc) {
      throw new Error('PDF not loaded');
    }

    if (pageNumber < 1 || pageNumber > this.pdfDoc.numPages) {
      return;
    }

    this.currentPage = pageNumber;
    const page = await this.pdfDoc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: this.scale });

    this.canvas.width = viewport.width;
    this.canvas.height = viewport.height;

    const renderContext = {
      canvasContext: this.context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
  }

  /**
   * Navigate to next page
   */
  async nextPage(): Promise<boolean> {
    if (!this.pdfDoc || this.currentPage >= this.pdfDoc.numPages) {
      return false;
    }
    await this.renderPage(this.currentPage + 1);
    return true;
  }

  /**
   * Navigate to previous page
   */
  async previousPage(): Promise<boolean> {
    if (!this.pdfDoc || this.currentPage <= 1) {
      return false;
    }
    await this.renderPage(this.currentPage - 1);
    return true;
  }

  /**
   * Go to specific page
   */
  async goToPage(pageNumber: number): Promise<void> {
    await this.renderPage(pageNumber);
  }

  /**
   * Highlight a region on the PDF
   */
  highlightRegion(boundingBox: BoundingBox): void {
    // Clear previous highlights
    this.clearHighlights();

    // Only highlight if on the correct page
    if (boundingBox.page !== this.currentPage) {
      return;
    }

    const highlightDiv = document.createElement('div');
    highlightDiv.className = 'pdf-highlight';
    highlightDiv.style.left = `${boundingBox.x * this.scale}px`;
    highlightDiv.style.top = `${boundingBox.y * this.scale}px`;
    highlightDiv.style.width = `${boundingBox.width * this.scale}px`;
    highlightDiv.style.height = `${boundingBox.height * this.scale}px`;

    this.highlightLayer.appendChild(highlightDiv);
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    this.highlightLayer.innerHTML = '';
  }

  /**
   * Get current page number
   */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Get total number of pages
   */
  getTotalPages(): number {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }
}

/**
 * Script Viewer Manager
 * Handles script rendering, word-level highlighting, and auto-scroll
 */
export class ScriptViewerManager {
  private container: HTMLElement;
  private wordElements: Map<string, HTMLElement> = new Map();
  private currentHighlightedWord: HTMLElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Render the lecture script
   */
  renderScript(state: PlaybackState): void {
    this.container.innerHTML = '';
    this.wordElements.clear();

    state.script.segments.forEach((segment) => {
      const segmentDiv = document.createElement('div');
      segmentDiv.className = 'script-segment';

      const titleDiv = document.createElement('h3');
      titleDiv.className = 'segment-title';
      titleDiv.textContent = segment.title;
      segmentDiv.appendChild(titleDiv);

      segment.scriptBlocks.forEach((block) => {
        const blockDiv = document.createElement('div');
        blockDiv.className = 'script-block';
        blockDiv.dataset.blockId = block.id;
        blockDiv.dataset.pageNumber = block.contentReference.pageNumber.toString();

        // Split text into words and create spans
        const words = block.text.split(/(\s+)/);
        words.forEach((word, index) => {
          if (word.trim()) {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'script-word';
            wordSpan.textContent = word;
            wordSpan.dataset.blockId = block.id;
            wordSpan.dataset.wordIndex = index.toString();
            
            const wordKey = `${block.id}-${index}`;
            this.wordElements.set(wordKey, wordSpan);
            blockDiv.appendChild(wordSpan);
          } else {
            // Preserve whitespace
            blockDiv.appendChild(document.createTextNode(word));
          }
        });

        segmentDiv.appendChild(blockDiv);
      });

      this.container.appendChild(segmentDiv);
    });
  }

  /**
   * Highlight a specific word
   */
  highlightWord(wordKey: string): void {
    // Remove previous highlight
    if (this.currentHighlightedWord) {
      this.currentHighlightedWord.classList.remove('highlighted');
    }

    // Add new highlight
    const wordElement = this.wordElements.get(wordKey);
    if (wordElement) {
      wordElement.classList.add('highlighted');
      this.currentHighlightedWord = wordElement;
      this.scrollToWord(wordElement);
    }
  }

  /**
   * Scroll to keep highlighted word visible
   */
  private scrollToWord(element: HTMLElement): void {
    const containerRect = this.container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Check if element is outside visible area
    if (
      elementRect.top < containerRect.top ||
      elementRect.bottom > containerRect.bottom
    ) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }

  /**
   * Clear all highlights
   */
  clearHighlights(): void {
    if (this.currentHighlightedWord) {
      this.currentHighlightedWord.classList.remove('highlighted');
      this.currentHighlightedWord = null;
    }
  }

  /**
   * Get page number for a script block
   */
  getPageForBlock(blockId: string): number | null {
    const blockElement = this.container.querySelector(
      `[data-block-id="${blockId}"]`
    ) as HTMLElement;
    if (blockElement && blockElement.dataset.pageNumber) {
      return parseInt(blockElement.dataset.pageNumber, 10);
    }
    return null;
  }
}

/**
 * Audio Synchronization Manager
 * Handles audio playback and synchronization with highlighting
 */
export class AudioSyncManager {
  private audio: HTMLAudioElement;
  private wordTimings: WordTiming[];
  private onTimeUpdate: (currentTime: number) => void;

  constructor(
    audio: HTMLAudioElement,
    wordTimings: WordTiming[],
    onTimeUpdate: (currentTime: number) => void
  ) {
    this.audio = audio;
    this.wordTimings = wordTimings;
    this.onTimeUpdate = onTimeUpdate;

    // Attach event listeners
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate.bind(this));
    this.audio.addEventListener('seeked', this.handleSeeked.bind(this));
  }

  /**
   * Handle time update event
   */
  private handleTimeUpdate(): void {
    this.onTimeUpdate(this.audio.currentTime);
  }

  /**
   * Handle seek event
   */
  private handleSeeked(): void {
    this.onTimeUpdate(this.audio.currentTime);
  }

  /**
   * Find current word using binary search
   */
  findCurrentWord(currentTime: number): WordTiming | null {
    if (this.wordTimings.length === 0) {
      return null;
    }

    let left = 0;
    let right = this.wordTimings.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const timing = this.wordTimings[mid];

      if (currentTime >= timing.startTime && currentTime <= timing.endTime) {
        return timing;
      } else if (currentTime < timing.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    // If not found exactly, return the closest word
    if (left > 0 && left <= this.wordTimings.length) {
      return this.wordTimings[left - 1];
    }

    return null;
  }

  /**
   * Play audio
   */
  play(): void {
    this.audio.play();
  }

  /**
   * Pause audio
   */
  pause(): void {
    this.audio.pause();
  }

  /**
   * Seek to specific time
   */
  seek(time: number): void {
    this.audio.currentTime = time;
  }

  /**
   * Get current time
   */
  getCurrentTime(): number {
    return this.audio.currentTime;
  }

  /**
   * Get duration
   */
  getDuration(): number {
    return this.audio.duration || 0;
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    return !this.audio.paused;
  }
}

/**
 * Format time in MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
