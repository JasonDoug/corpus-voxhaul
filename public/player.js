// Immersive Reader Player - Main Application
// This file will be compiled from TypeScript in production

class ImmersivePlayer {
  constructor() {
    this.pdfViewer = null;
    this.scriptViewer = null;
    this.audioSync = null;
    this.playbackState = null;
    this.currentWordIndex = -1;
    
    this.initializeElements();
  }

  initializeElements() {
    // PDF elements
    this.pdfCanvas = document.getElementById('pdf-canvas');
    this.pdfHighlightLayer = document.getElementById('pdf-highlight-layer');
    this.currentPageSpan = document.getElementById('current-page');
    this.totalPagesSpan = document.getElementById('total-pages');
    this.prevPageBtn = document.getElementById('prev-page');
    this.nextPageBtn = document.getElementById('next-page');

    // Script elements
    this.scriptContainer = document.getElementById('script-viewer');

    // Audio elements
    this.audioPlayer = document.getElementById('audio-player');
    this.playPauseBtn = document.getElementById('play-pause');
    this.playIcon = this.playPauseBtn.querySelector('.play-icon');
    this.pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
    this.seekBar = document.getElementById('seek-bar');
    this.progressBar = document.getElementById('progress-bar');
    this.currentTimeSpan = document.getElementById('current-time');
    this.totalTimeSpan = document.getElementById('total-time');

    // Job info
    this.jobIdSpan = document.getElementById('job-id');

    this.attachEventListeners();
  }

  attachEventListeners() {
    // PDF navigation
    this.prevPageBtn.addEventListener('click', () => this.previousPage());
    this.nextPageBtn.addEventListener('click', () => this.nextPage());

    // Audio controls
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.seekBar.addEventListener('input', (e) => this.handleSeek(e));
    this.audioPlayer.addEventListener('timeupdate', () => this.handleTimeUpdate());
    this.audioPlayer.addEventListener('loadedmetadata', () => this.handleMetadataLoaded());
    this.audioPlayer.addEventListener('ended', () => this.handleAudioEnded());
  }

  async loadPlaybackData(jobId) {
    try {
      // Fetch playback data from API
      const response = await fetch(`/api/playback/${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to load playback data');
      }

      this.playbackState = await response.json();
      this.jobIdSpan.textContent = `Job: ${jobId}`;

      await this.initializePlayer();
    } catch (error) {
      console.error('Error loading playback data:', error);
      this.showError('Failed to load lecture. Please try again.');
    }
  }

  async initializePlayer() {
    // Initialize PDF viewer
    await this.initializePDFViewer();

    // Initialize script viewer
    this.initializeScriptViewer();

    // Initialize audio
    this.initializeAudio();
  }

  async initializePDFViewer() {
    try {
      const pdfjsLib = window.pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = 
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const loadingTask = pdfjsLib.getDocument(this.playbackState.pdfUrl);
      this.pdfDoc = await loadingTask.promise;
      
      this.totalPagesSpan.textContent = this.pdfDoc.numPages;
      await this.renderPDFPage(1);
    } catch (error) {
      console.error('Error loading PDF:', error);
      this.showError('Failed to load PDF document.');
    }
  }

  async renderPDFPage(pageNumber) {
    if (!this.pdfDoc || pageNumber < 1 || pageNumber > this.pdfDoc.numPages) {
      return;
    }

    this.currentPage = pageNumber;
    this.currentPageSpan.textContent = pageNumber;

    const page = await this.pdfDoc.getPage(pageNumber);
    const scale = 1.5;
    const viewport = page.getViewport({ scale });

    this.pdfCanvas.width = viewport.width;
    this.pdfCanvas.height = viewport.height;

    const context = this.pdfCanvas.getContext('2d');
    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    // Update button states
    this.prevPageBtn.disabled = pageNumber === 1;
    this.nextPageBtn.disabled = pageNumber === this.pdfDoc.numPages;

    // Clear highlights when changing pages
    this.clearPDFHighlights();
  }

  async previousPage() {
    if (this.currentPage > 1) {
      await this.renderPDFPage(this.currentPage - 1);
    }
  }

  async nextPage() {
    if (this.currentPage < this.pdfDoc.numPages) {
      await this.renderPDFPage(this.currentPage + 1);
    }
  }

  initializeScriptViewer() {
    this.scriptContainer.innerHTML = '';
    this.wordElements = [];

    let globalWordIndex = 0;

    this.playbackState.script.segments.forEach((segment) => {
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

        // Split text into words
        const words = block.text.split(/(\s+)/);
        words.forEach((word) => {
          if (word.trim()) {
            const wordSpan = document.createElement('span');
            wordSpan.className = 'script-word';
            wordSpan.textContent = word;
            wordSpan.dataset.wordIndex = globalWordIndex.toString();
            wordSpan.dataset.blockId = block.id;
            
            this.wordElements.push({
              element: wordSpan,
              blockId: block.id,
              pageNumber: block.contentReference.pageNumber,
              index: globalWordIndex
            });
            
            globalWordIndex++;
            blockDiv.appendChild(wordSpan);
          } else {
            blockDiv.appendChild(document.createTextNode(word));
          }
        });

        segmentDiv.appendChild(blockDiv);
      });

      this.scriptContainer.appendChild(segmentDiv);
    });
  }

  initializeAudio() {
    this.audioPlayer.src = this.playbackState.audioUrl;
    this.audioPlayer.load();
  }

  handleMetadataLoaded() {
    const duration = this.audioPlayer.duration;
    this.totalTimeSpan.textContent = this.formatTime(duration);
    this.seekBar.max = duration;
  }

  togglePlayPause() {
    if (this.audioPlayer.paused) {
      this.audioPlayer.play();
      this.playIcon.style.display = 'none';
      this.pauseIcon.style.display = 'inline';
    } else {
      this.audioPlayer.pause();
      this.playIcon.style.display = 'inline';
      this.pauseIcon.style.display = 'none';
    }
  }

  handleSeek(event) {
    const time = parseFloat(event.target.value);
    this.audioPlayer.currentTime = time;
    this.updateHighlighting(time);
  }

  handleTimeUpdate() {
    const currentTime = this.audioPlayer.currentTime;
    
    // Update time display
    this.currentTimeSpan.textContent = this.formatTime(currentTime);
    
    // Update progress bar
    const duration = this.audioPlayer.duration || 0;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    this.progressBar.style.width = `${progress}%`;
    this.seekBar.value = currentTime;

    // Update highlighting
    this.updateHighlighting(currentTime);
  }

  updateHighlighting(currentTime) {
    // Find current word using binary search
    const currentWord = this.findCurrentWord(currentTime);
    
    if (!currentWord) {
      return;
    }

    // Find the word element in script
    const wordElement = this.wordElements.find(w => 
      w.blockId === currentWord.scriptBlockId && 
      this.matchesWord(w.element.textContent, currentWord.word)
    );

    if (wordElement && wordElement.index !== this.currentWordIndex) {
      // Remove previous highlight
      if (this.currentWordIndex >= 0 && this.wordElements[this.currentWordIndex]) {
        this.wordElements[this.currentWordIndex].element.classList.remove('highlighted');
      }

      // Add new highlight
      wordElement.element.classList.add('highlighted');
      this.currentWordIndex = wordElement.index;

      // Scroll to keep visible
      this.scrollToWord(wordElement.element);

      // Update PDF page if needed
      if (wordElement.pageNumber !== this.currentPage) {
        this.renderPDFPage(wordElement.pageNumber);
      }
    }
  }

  findCurrentWord(currentTime) {
    const timings = this.playbackState.wordTimings;
    
    if (!timings || timings.length === 0) {
      return null;
    }

    // Binary search
    let left = 0;
    let right = timings.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const timing = timings[mid];

      if (currentTime >= timing.startTime && currentTime <= timing.endTime) {
        return timing;
      } else if (currentTime < timing.startTime) {
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    // Return closest word
    if (left > 0 && left <= timings.length) {
      return timings[left - 1];
    }

    return timings[0];
  }

  matchesWord(elementText, timingWord) {
    // Simple matching - normalize and compare
    const normalize = (str) => str.toLowerCase().replace(/[^\w]/g, '');
    return normalize(elementText) === normalize(timingWord);
  }

  scrollToWord(element) {
    const containerRect = this.scriptContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

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

  clearPDFHighlights() {
    this.pdfHighlightLayer.innerHTML = '';
  }

  handleAudioEnded() {
    this.playIcon.style.display = 'inline';
    this.pauseIcon.style.display = 'none';
  }

  formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00';
    }
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  showError(message) {
    this.scriptContainer.innerHTML = `
      <div class="error">
        <div class="error-message">${message}</div>
      </div>
    `;
  }
}

// Initialize player when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const player = new ImmersivePlayer();
  
  // Get job ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const jobId = urlParams.get('jobId');
  
  if (jobId) {
    player.loadPlaybackData(jobId);
  } else {
    player.showError('No job ID provided');
  }
});
