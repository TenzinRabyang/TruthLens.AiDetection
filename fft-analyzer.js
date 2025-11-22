/**
 * FFT Analyzer - Core AI Video Detection Engine
 * Implements FFT fingerprinting to detect AI-generated videos
 */

class FFTAnalyzer {
    constructor() {
        this.frameSize = 256; // Power of 2 for efficient FFT
        this.sampleFrames = 5; // Number of frames to analyze
    }

    /**
     * Analyze video for AI generation artifacts
     * @param {HTMLVideoElement} video - Video element to analyze
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeVideo(video, progressCallback = null) {
        try {
            const frames = await this.extractFrames(video, this.sampleFrames, progressCallback);
            const fftResults = [];

            for (let i = 0; i < frames.length; i++) {
                const fftData = await this.computeFFT(frames[i]);
                fftResults.push(fftData);

                if (progressCallback) {
                    progressCallback((i + 1) / frames.length * 100);
                }
            }

            // Analyze patterns across all frames
            const analysis = this.detectAIPatterns(fftResults);

            return {
                isAIGenerated: analysis.isAI,
                confidence: analysis.confidence,
                patterns: analysis.patterns,
                fftData: fftResults[0], // Return first frame's FFT for visualization
                details: analysis.details
            };
        } catch (error) {
            console.error('Analysis error:', error);
            throw error;
        }
    }

    /**
     * Extract frames from video at regular intervals
     * @param {HTMLVideoElement} video - Video element
     * @param {number} numFrames - Number of frames to extract
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Array>} Array of ImageData objects
     */
    async extractFrames(video, numFrames, progressCallback) {
        const frames = [];
        const duration = video.duration;
        const interval = duration / (numFrames + 1);

        for (let i = 1; i <= numFrames; i++) {
            const time = interval * i;
            const frameData = await this.seekAndExtract(video, time);
            frames.push(frameData);

            if (progressCallback) {
                progressCallback((i / numFrames) * 50); // First 50% is frame extraction
            }
        }

        return frames;
    }

    /**
     * Seek to time and extract frame
     * @param {HTMLVideoElement} video - Video element
     * @param {number} time - Time in seconds
     * @returns {Promise<ImageData>} Frame data
     */
    seekAndExtract(video, time) {
        return new Promise((resolve) => {
            const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                const frameData = Utils.extractFrame(video, this.frameSize);
                resolve(frameData);
            };

            video.addEventListener('seeked', onSeeked);
            video.currentTime = time;
        });
    }

    /**
     * Compute 2D FFT on image data
     * @param {ImageData} imageData - Frame image data
     * @returns {Object} FFT result with magnitude spectrum
     */
    async computeFFT(imageData) {
        // Convert to grayscale
        let grayscale = Utils.rgbToGrayscale(imageData);

        // Apply high-pass filter to isolate texture
        grayscale = Utils.applyHighPassFilter(grayscale, this.frameSize, this.frameSize);

        // Compute 2D FFT
        const fftResult = this.fft2D(grayscale, this.frameSize, this.frameSize);

        // Calculate magnitude spectrum
        const magnitude = Utils.calculateMagnitude(fftResult.real, fftResult.imag);

        // Convert to log scale (dB)
        const logMagnitude = Utils.toLogScale(magnitude);

        // Shift to center low frequencies
        const shifted = Utils.fftShift(logMagnitude, this.frameSize, this.frameSize);

        return {
            magnitude: shifted,
            width: this.frameSize,
            height: this.frameSize
        };
    }

    /**
     * 2D FFT implementation using row-column algorithm
     * @param {Float32Array} data - Input data
     * @param {number} width - Data width
     * @param {number} height - Data height
     * @returns {Object} Real and imaginary components
     */
    fft2D(data, width, height) {
        // Initialize real and imaginary arrays
        const real = new Float32Array(data.length);
        const imag = new Float32Array(data.length);

        // Copy input to real part
        for (let i = 0; i < data.length; i++) {
            real[i] = data[i];
        }

        // FFT on rows
        for (let y = 0; y < height; y++) {
            const rowReal = real.slice(y * width, (y + 1) * width);
            const rowImag = imag.slice(y * width, (y + 1) * width);

            this.fft1D(rowReal, rowImag);

            for (let x = 0; x < width; x++) {
                real[y * width + x] = rowReal[x];
                imag[y * width + x] = rowImag[x];
            }
        }

        // FFT on columns
        for (let x = 0; x < width; x++) {
            const colReal = new Float32Array(height);
            const colImag = new Float32Array(height);

            for (let y = 0; y < height; y++) {
                colReal[y] = real[y * width + x];
                colImag[y] = imag[y * width + x];
            }

            this.fft1D(colReal, colImag);

            for (let y = 0; y < height; y++) {
                real[y * width + x] = colReal[y];
                imag[y * width + x] = colImag[y];
            }
        }

        return { real, imag };
    }

    /**
     * 1D FFT using Cooley-Tukey algorithm
     * @param {Float32Array} real - Real components (modified in place)
     * @param {Float32Array} imag - Imaginary components (modified in place)
     */
    fft1D(real, imag) {
        const n = real.length;

        if (n <= 1) return;

        // Bit-reversal permutation
        let j = 0;
        for (let i = 0; i < n - 1; i++) {
            if (i < j) {
                [real[i], real[j]] = [real[j], real[i]];
                [imag[i], imag[j]] = [imag[j], imag[i]];
            }

            let k = n >> 1;
            while (k <= j) {
                j -= k;
                k >>= 1;
            }
            j += k;
        }

        // Cooley-Tukey decimation-in-time radix-2 FFT
        for (let len = 2; len <= n; len <<= 1) {
            const halfLen = len >> 1;
            const angle = -2 * Math.PI / len;

            for (let i = 0; i < n; i += len) {
                let wReal = 1;
                let wImag = 0;

                for (let j = 0; j < halfLen; j++) {
                    const evenIdx = i + j;
                    const oddIdx = i + j + halfLen;

                    const tReal = wReal * real[oddIdx] - wImag * imag[oddIdx];
                    const tImag = wReal * imag[oddIdx] + wImag * real[oddIdx];

                    real[oddIdx] = real[evenIdx] - tReal;
                    imag[oddIdx] = imag[evenIdx] - tImag;
                    real[evenIdx] += tReal;
                    imag[evenIdx] += tImag;

                    const nextWReal = wReal * Math.cos(angle) - wImag * Math.sin(angle);
                    const nextWImag = wReal * Math.sin(angle) + wImag * Math.cos(angle);
                    wReal = nextWReal;
                    wImag = nextWImag;
                }
            }
        }
    }

    /**
     * Detect AI generation patterns in FFT data
     * @param {Array} fftResults - Array of FFT results from multiple frames
     * @returns {Object} Detection results
     */
    detectAIPatterns(fftResults) {
        const patterns = {
            gridPattern: 0,
            brightDots: 0,
            crossShape: 0,
            checkerboard: 0,
            smoothGradient: 0
        };

        const details = [];

        for (const fftData of fftResults) {
            const analysis = this.analyzeFFTPattern(fftData.magnitude, fftData.width, fftData.height);

            patterns.gridPattern += analysis.gridPattern;
            patterns.brightDots += analysis.brightDots;
            patterns.crossShape += analysis.crossShape;
            patterns.checkerboard += analysis.checkerboard;
            patterns.smoothGradient += analysis.smoothGradient;
        }

        // Average across frames
        const numFrames = fftResults.length;
        for (const key in patterns) {
            patterns[key] /= numFrames;
        }

        // Calculate AI likelihood
        const aiScore = (
            patterns.gridPattern * 0.3 +
            patterns.brightDots * 0.25 +
            patterns.crossShape * 0.25 +
            patterns.checkerboard * 0.2
        );

        const realScore = patterns.smoothGradient;

        const isAI = aiScore > realScore;
        const confidence = Math.min(Math.abs(aiScore - realScore) * 100, 99);

        // Generate detailed explanation
        if (isAI) {
            if (patterns.gridPattern > 0.5) {
                details.push('Strong grid pattern detected - characteristic of CNN upsampling');
            }
            if (patterns.brightDots > 0.5) {
                details.push('Regular bright dots found - indicates periodic artifacts');
            }
            if (patterns.crossShape > 0.5) {
                details.push('Cross/plus shape pattern - common in GAN-generated content');
            }
            if (patterns.checkerboard > 0.4) {
                details.push('Checkerboard effect visible - typical of diffusion models');
            }
        } else {
            details.push('Smooth, natural frequency distribution detected');
            details.push('No geometric patterns or regular artifacts found');
            details.push('Frequency spectrum matches real camera footage');
        }

        return {
            isAI,
            confidence,
            patterns,
            details
        };
    }

    /**
     * Analyze FFT magnitude spectrum for specific patterns
     * @param {Float32Array} magnitude - FFT magnitude data
     * @param {number} width - Data width
     * @param {number} height - Data height
     * @returns {Object} Pattern scores
     */
    analyzeFFTPattern(magnitude, width, height) {
        const centerX = width / 2;
        const centerY = height / 2;

        let gridPattern = 0;
        let brightDots = 0;
        let crossShape = 0;
        let checkerboard = 0;
        let smoothGradient = 0;

        // Normalize magnitude for analysis
        const normalized = Utils.normalize(magnitude);

        // Detect grid pattern (periodic peaks)
        const gridSize = 16;
        for (let y = gridSize; y < height; y += gridSize) {
            for (let x = gridSize; x < width; x += gridSize) {
                const idx = y * width + x;
                if (normalized[idx] > 200) {
                    gridPattern += 1;
                }
            }
        }
        gridPattern = Math.min(gridPattern / 100, 1);

        // Detect bright dots (high-intensity isolated points)
        let brightCount = 0;
        for (let i = 0; i < normalized.length; i++) {
            if (normalized[i] > 240) {
                brightCount++;
            }
        }
        brightDots = Math.min(brightCount / 500, 1);

        // Detect cross shape (high values along axes)
        let crossCount = 0;
        const threshold = 180;
        for (let i = 0; i < width; i++) {
            if (normalized[Math.floor(centerY) * width + i] > threshold) crossCount++;
            if (normalized[i * width + Math.floor(centerX)] > threshold) crossCount++;
        }
        crossShape = Math.min(crossCount / (width * 2), 1);

        // Detect checkerboard (alternating pattern)
        let checkerCount = 0;
        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const current = normalized[y * width + x];
                const right = normalized[y * width + (x + 1)];
                const down = normalized[(y + 1) * width + x];

                if (Math.abs(current - right) > 100 || Math.abs(current - down) > 100) {
                    checkerCount++;
                }
            }
        }
        checkerboard = Math.min(checkerCount / (width * height), 1);

        // Detect smooth gradient (natural pattern)
        let gradientSmooth = 0;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const current = normalized[y * width + x];
                const neighbors = [
                    normalized[(y - 1) * width + x],
                    normalized[(y + 1) * width + x],
                    normalized[y * width + (x - 1)],
                    normalized[y * width + (x + 1)]
                ];

                const avgDiff = neighbors.reduce((sum, n) => sum + Math.abs(current - n), 0) / 4;
                if (avgDiff < 30) {
                    gradientSmooth++;
                }
            }
        }
        smoothGradient = gradientSmooth / (width * height);

        return {
            gridPattern,
            brightDots,
            crossShape,
            checkerboard,
            smoothGradient
        };
    }
}
