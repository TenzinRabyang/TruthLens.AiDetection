/**
 * Main Application Logic
 * Handles user interactions and orchestrates analysis
 */

class AIVideoDetectionApp {
    constructor() {
        this.analyzer = new FFTAnalyzer();
        this.visualizer = new FFTVisualizer('fftCanvas');
        this.youtubeHandler = new YouTubeHandler();
        this.currentVideo = null;
        this.currentVideoSource = 'file'; // 'file' or 'youtube'
        this.maxFileSize = 3000 * 1024 * 1024; // 3000MB (3GB) in bytes
        this.supportedFormats = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'];

        this.initializeElements();
        this.attachEventListeners();
        this.visualizer.showPlaceholder();
    }

    initializeElements() {
        // Upload elements
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');

        // Tab elements
        this.tabBtns = document.querySelectorAll('.tab-btn');
        this.fileTab = document.getElementById('fileTab');
        this.youtubeTab = document.getElementById('youtubeTab');

        // YouTube elements
        this.youtubeUrlInput = document.getElementById('youtubeUrlInput');
        this.loadYoutubeBtn = document.getElementById('loadYoutubeBtn');
        this.youtubePlayerContainer = document.getElementById('youtubePlayerContainer');

        // Video elements
        this.videoSection = document.getElementById('videoSection');
        this.videoPlayer = document.getElementById('videoPlayer');
        this.analyzeBtn = document.getElementById('analyzeBtn');
        this.resetBtn = document.getElementById('resetBtn');

        // FFT elements
        this.fftSection = document.getElementById('fftSection');
        this.fftLoading = document.getElementById('fftLoading');
        this.progressFill = document.getElementById('progressFill');

        // Results elements
        this.resultsSection = document.getElementById('resultsSection');
        this.resultBadge = document.getElementById('resultBadge');
        this.confidenceValue = document.getElementById('confidenceValue');
        this.confidenceFill = document.getElementById('confidenceFill');
        this.detectionDetails = document.getElementById('detectionDetails');
    }

    attachEventListeners() {
        // Tab switching
        this.tabBtns.forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Upload zone interactions
        this.uploadZone.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadZone.addEventListener('drop', (e) => this.handleDrop(e));

        // YouTube interactions
        this.loadYoutubeBtn.addEventListener('click', () => this.handleYoutubeLoad());
        this.youtubeUrlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleYoutubeLoad();
        });

        // Button interactions
        this.analyzeBtn.addEventListener('click', () => this.analyzeVideo());
        this.resetBtn.addEventListener('click', () => this.reset());

        // Window resize
        window.addEventListener('resize', Utils.debounce(() => {
            this.visualizer.setupCanvas();
            this.visualizer.showPlaceholder();
        }, 250));
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadZone.classList.add('drag-over');
    }

    handleDragLeave(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('drag-over');
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.loadVideo(files[0]);
        }
    }

    handleFileSelect(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.loadVideo(files[0]);
        }
    }

    /**
     * Switch between upload tabs
     * @param {string} tabName - Tab to switch to ('file' or 'youtube')
     */
    switchTab(tabName) {
        // Update tab buttons
        this.tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update tab content
        if (tabName === 'file') {
            this.fileTab.classList.add('active');
            this.youtubeTab.classList.remove('active');
        } else {
            this.fileTab.classList.remove('active');
            this.youtubeTab.classList.add('active');
        }
    }

    /**
     * Handle YouTube URL loading
     */
    async handleYoutubeLoad() {
        const url = this.youtubeUrlInput.value.trim();

        // Validate URL
        const validation = this.youtubeHandler.validateURL(url);
        if (!validation.valid) {
            this.showError(validation.error, validation.details);
            return;
        }

        try {
            // Show loading state
            this.loadYoutubeBtn.disabled = true;
            this.loadYoutubeBtn.textContent = '⏳ Loading...';

            // Try to load YouTube video
            await this.loadYoutubeVideo(validation.videoId);

            console.log(`✓ YouTube video loaded: ${validation.videoId}`);

        } catch (error) {
            console.error('YouTube load error:', error);

            // Show download instructions
            this.youtubeHandler.showDownloadInstructions(
                validation.videoId,
                (title, message) => this.showError(title, message)
            );
        } finally {
            this.loadYoutubeBtn.disabled = false;
            this.loadYoutubeBtn.textContent = 'Load Video';
        }
    }

    /**
     * Load YouTube video in iframe
     * @param {string} videoId - YouTube video ID
     */
    async loadYoutubeVideo(videoId) {
        // Hide regular video player, show YouTube container
        this.videoPlayer.classList.add('hidden');
        this.youtubePlayerContainer.classList.remove('hidden');

        // Load video
        await this.youtubeHandler.loadVideo(videoId, this.youtubePlayerContainer);

        this.currentVideoSource = 'youtube';
        this.currentVideo = videoId;

        // Show video section
        this.videoSection.classList.remove('hidden');
        this.fftSection.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');

        // Scroll to video
        setTimeout(() => {
            this.videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    }

    /**
     * Validate uploaded file
     * @param {File} file - File to validate
     * @returns {Object} Validation result
     */
    validateFile(file) {
        // Check if file exists
        if (!file) {
            return {
                valid: false,
                error: 'No File Selected',
                details: 'Please select a video file to upload.'
            };
        }

        // Check file type
        if (!file.type.startsWith('video/')) {
            return {
                valid: false,
                error: 'Invalid File Type',
                details: `The selected file "${file.name}" is not a video file. Please upload a video in MP4, WebM, MOV, or MKV format.`
            };
        }

        // Check if format is supported
        if (!this.supportedFormats.includes(file.type)) {
            return {
                valid: false,
                error: 'Unsupported Video Format',
                details: `The video format "${file.type}" may not be supported. Recommended formats: MP4, WebM, MOV, or MKV.`
            };
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            const fileSize = Utils.formatFileSize(file.size);
            const maxSize = Utils.formatFileSize(this.maxFileSize);
            return {
                valid: false,
                error: 'File Too Large',
                details: `The video file "${file.name}" is ${fileSize}, which exceeds the maximum allowed size of ${maxSize}. Please upload a smaller video file.`
            };
        }

        // Check if file is empty
        if (file.size === 0) {
            return {
                valid: false,
                error: 'Empty File',
                details: 'The selected file appears to be empty. Please select a valid video file.'
            };
        }

        return { valid: true };
    }

    loadVideo(file) {
        // Comprehensive file validation
        const validation = this.validateFile(file);
        if (!validation.valid) {
            this.showError(validation.error, validation.details);
            return;
        }

        try {
            // Create object URL
            const url = URL.createObjectURL(file);
            this.currentVideo = url;
            this.currentVideoSource = 'file';

            // Show regular video player, hide YouTube container
            this.videoPlayer.classList.remove('hidden');
            this.youtubePlayerContainer.classList.add('hidden');

            // Load video with error handling
            this.videoPlayer.src = url;
            this.videoPlayer.onerror = () => {
                this.showError(
                    'Video Load Error',
                    'Unable to load the video file. The file may be corrupted or in an unsupported format.'
                );
                this.reset();
            };
            this.videoPlayer.load();

            // Show video section
            this.videoSection.classList.remove('hidden');
            this.fftSection.classList.remove('hidden');
            this.resultsSection.classList.add('hidden');

            // Scroll to video
            setTimeout(() => {
                this.videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);

            console.log(`✓ Loaded video: ${file.name} (${Utils.formatFileSize(file.size)})`);
        } catch (error) {
            console.error('Error loading video:', error);
            this.showError(
                'Upload Failed',
                'An unexpected error occurred while loading the video. Please try again.'
            );
        }
    }

    async analyzeVideo() {
        if (!this.currentVideo) {
            this.showError(
                'No Video Loaded',
                'Please upload a video file or load a YouTube video before starting the analysis.'
            );
            return;
        }

        // Check if video is ready (only for file uploads)
        if (this.currentVideoSource === 'file' && this.videoPlayer.readyState < 2) {
            this.showError(
                'Video Not Ready',
                'The video is still loading. Please wait a moment and try again.'
            );
            return;
        }

        // Disable button
        this.analyzeBtn.disabled = true;
        this.analyzeBtn.textContent = '⏳ Analyzing...';

        // Show loading overlay
        this.fftLoading.classList.remove('hidden');
        this.resultsSection.classList.add('hidden');

        try {
            // Run analysis
            const results = await this.analyzer.analyzeVideo(
                this.videoPlayer,
                (progress) => this.updateProgress(progress)
            );

            // Hide loading
            this.fftLoading.classList.add('hidden');

            // Visualize FFT
            await this.visualizer.animateIn();
            this.visualizer.render(
                results.fftData.magnitude,
                results.fftData.width,
                results.fftData.height
            );

            // Display results
            this.displayResults(results);

            // Scroll to results
            setTimeout(() => {
                this.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 500);

        } catch (error) {
            console.error('Analysis failed:', error);
            this.fftLoading.classList.add('hidden');

            // Determine error type and show appropriate message
            let errorTitle = 'Analysis Failed';
            let errorMessage = 'An error occurred during video analysis. Please try again with a different video.';

            if (error.message.includes('frame')) {
                errorTitle = 'Frame Extraction Error';
                errorMessage = 'Unable to extract frames from the video. The video may be corrupted or in an incompatible format.';
            } else if (error.message.includes('FFT')) {
                errorTitle = 'FFT Computation Error';
                errorMessage = 'An error occurred during frequency analysis. Please try a different video.';
            } else if (error.message.includes('memory')) {
                errorTitle = 'Memory Error';
                errorMessage = 'The video is too large to process. Please try a shorter or lower resolution video.';
            }

            this.showError(errorTitle, errorMessage);
        } finally {
            this.analyzeBtn.disabled = false;
            this.analyzeBtn.textContent = '🔍 Analyze Video';
        }
    }

    updateProgress(progress) {
        this.progressFill.style.width = `${progress}%`;
    }

    displayResults(results) {
        // Show results section
        this.resultsSection.classList.remove('hidden');
        this.resultsSection.classList.add('visible');

        // Set badge
        if (results.isAIGenerated) {
            this.resultBadge.textContent = '⚠️ AI Generated';
            this.resultBadge.className = 'result-badge ai-generated';
            this.confidenceFill.style.background = 'var(--gradient-danger)';
        } else {
            this.resultBadge.textContent = '✓ Real Video';
            this.resultBadge.className = 'result-badge real-video';
            this.confidenceFill.style.background = 'var(--gradient-success)';
        }

        // Set confidence
        const confidence = Math.round(results.confidence);
        this.confidenceValue.textContent = `${confidence}%`;
        this.confidenceFill.style.width = `${confidence}%`;

        // Set details
        this.detectionDetails.innerHTML = '';
        results.details.forEach(detail => {
            const li = document.createElement('li');
            li.textContent = detail;
            this.detectionDetails.appendChild(li);
        });

        // Add pattern scores
        const patternsLi = document.createElement('li');
        patternsLi.innerHTML = `<strong>Pattern Analysis:</strong>`;
        this.detectionDetails.appendChild(patternsLi);

        const patternsList = document.createElement('ul');
        patternsList.style.marginLeft = '20px';
        patternsList.style.fontSize = '0.875rem';

        const patternNames = {
            gridPattern: 'Grid Pattern',
            brightDots: 'Bright Dots',
            crossShape: 'Cross Shape',
            checkerboard: 'Checkerboard',
            smoothGradient: 'Smooth Gradient'
        };

        for (const [key, value] of Object.entries(results.patterns)) {
            const li = document.createElement('li');
            const percentage = Math.round(value * 100);
            const bar = '█'.repeat(Math.floor(percentage / 10));
            li.textContent = `${patternNames[key]}: ${bar} ${percentage}%`;
            li.style.fontFamily = 'var(--font-mono)';
            li.style.color = percentage > 50 ? 'var(--color-accent-primary)' : 'var(--color-text-muted)';
            patternsList.appendChild(li);
        }

        this.detectionDetails.appendChild(patternsList);

        console.log('Analysis complete:', results);
    }

    reset() {
        // Clear video
        if (this.currentVideo && this.currentVideoSource === 'file') {
            URL.revokeObjectURL(this.currentVideo);
        }
        this.currentVideo = null;
        this.currentVideoSource = 'file';

        this.videoPlayer.src = '';
        this.fileInput.value = '';
        this.youtubeUrlInput.value = '';
        this.youtubePlayerContainer.innerHTML = '';

        // Show/hide video player elements
        this.videoPlayer.classList.remove('hidden');
        this.youtubePlayerContainer.classList.add('hidden');

        // Hide sections
        this.videoSection.classList.add('hidden');
        this.fftSection.classList.add('hidden');
        this.resultsSection.classList.add('hidden');

        // Reset visualizer
        this.visualizer.showPlaceholder();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    /**
     * Show custom error modal
     * @param {string} title - Error title
     * @param {string} message - Error message
     */
    showError(title, message) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('errorModal');
        if (!modal) {
            modal = this.createErrorModal();
            document.body.appendChild(modal);
        }

        // Set content
        const modalTitle = modal.querySelector('.error-title');
        const modalMessage = modal.querySelector('.error-message');
        modalTitle.textContent = title;
        modalMessage.textContent = message;

        // Show modal
        modal.classList.add('visible');

        // Log to console
        console.error(`${title}: ${message}`);
    }

    /**
     * Create error modal element
     * @returns {HTMLElement} Modal element
     */
    createErrorModal() {
        const modal = document.createElement('div');
        modal.id = 'errorModal';
        modal.className = 'error-modal';
        modal.innerHTML = `
            <div class="error-modal-overlay"></div>
            <div class="error-modal-content">
                <div class="error-icon">⚠️</div>
                <h3 class="error-title"></h3>
                <p class="error-message"></p>
                <button class="btn btn-primary error-close-btn">OK</button>
            </div>
        `;

        // Close button handler
        const closeBtn = modal.querySelector('.error-close-btn');
        const overlay = modal.querySelector('.error-modal-overlay');

        const closeModal = () => {
            modal.classList.remove('visible');
        };

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', closeModal);

        return modal;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AIVideoDetectionApp();
    console.log('AI Video Detection App initialized');
});
