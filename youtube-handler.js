/**
 * YouTube Handler
 * Handles YouTube URL validation and video loading
 */

class YouTubeHandler {
    constructor() {
        this.videoIdPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/;
    }

    /**
     * Extract YouTube video ID from URL
     * @param {string} url - YouTube URL
     * @returns {string|null} Video ID or null
     */
    extractVideoId(url) {
        // Trim whitespace
        url = url.trim();

        // Check if it's already a video ID (11 characters)
        if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
            return url;
        }

        // Try to extract from URL
        const match = url.match(this.videoIdPattern);
        return match ? match[1] : null;
    }

    /**
     * Validate YouTube URL
     * @param {string} url - URL to validate
     * @returns {Object} Validation result
     */
    validateURL(url) {
        if (!url || url.trim() === '') {
            return {
                valid: false,
                error: 'Empty URL',
                details: 'Please enter a YouTube video URL.'
            };
        }

        const videoId = this.extractVideoId(url);

        if (!videoId) {
            return {
                valid: false,
                error: 'Invalid YouTube URL',
                details: 'The URL you entered is not a valid YouTube video link. Please use a URL like: https://www.youtube.com/watch?v=VIDEO_ID'
            };
        }

        return {
            valid: true,
            videoId: videoId
        };
    }

    /**
     * Create YouTube embed URL
     * @param {string} videoId - YouTube video ID
     * @returns {string} Embed URL
     */
    getEmbedURL(videoId) {
        return `https://www.youtube.com/embed/${videoId}?enablejsapi=1&origin=${window.location.origin}`;
    }

    /**
     * Load YouTube video in iframe
     * @param {string} videoId - YouTube video ID
     * @param {HTMLElement} container - Container element
     * @returns {Promise} Promise that resolves when video is loaded
     */
    async loadVideo(videoId, container) {
        return new Promise((resolve, reject) => {
            // Clear container
            container.innerHTML = '';

            // Create iframe
            const iframe = document.createElement('iframe');
            iframe.id = 'youtubeIframe';
            iframe.width = '100%';
            iframe.height = '100%';
            iframe.src = this.getEmbedURL(videoId);
            iframe.frameBorder = '0';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
            iframe.allowFullscreen = true;

            // Handle load
            iframe.onload = () => {
                console.log('✓ YouTube video loaded:', videoId);
                resolve(iframe);
            };

            // Handle error
            iframe.onerror = () => {
                reject(new Error('Failed to load YouTube video'));
            };

            container.appendChild(iframe);

            // Timeout after 10 seconds
            setTimeout(() => {
                if (!iframe.contentDocument) {
                    reject(new Error('YouTube video load timeout'));
                }
            }, 10000);
        });
    }

    /**
     * Get download instructions for manual download
     * @param {string} videoId - YouTube video ID
     * @returns {Object} Instructions object
     */
    getDownloadInstructions(videoId) {
        const videoURL = `https://www.youtube.com/watch?v=${videoId}`;

        return {
            title: 'Manual Download Required',
            message: `This YouTube video cannot be analyzed directly due to embedding restrictions. Please follow these steps:`,
            steps: [
                `1. Copy this URL: ${videoURL}`,
                `2. Use a YouTube downloader (browser extension or online tool)`,
                `3. Download the video to your computer`,
                `4. Switch to the "Upload File" tab above`,
                `5. Upload the downloaded video for analysis`
            ],
            videoURL: videoURL,
            videoId: videoId
        };
    }

    /**
     * Show download instructions modal
     * @param {string} videoId - YouTube video ID
     * @param {Function} showErrorCallback - Error display callback
     */
    showDownloadInstructions(videoId, showErrorCallback) {
        const instructions = this.getDownloadInstructions(videoId);

        const message = `${instructions.message}\n\n${instructions.steps.join('\n')}\n\nVideo URL: ${instructions.videoURL}`;

        showErrorCallback(instructions.title, message);
    }
}
