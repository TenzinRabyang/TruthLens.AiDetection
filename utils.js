/**
 * Utility Functions for AI Video Detection
 * Mathematical and image processing helpers
 */

const Utils = {
    /**
     * Convert RGB image data to grayscale
     * @param {ImageData} imageData - Canvas ImageData object
     * @returns {Float32Array} Grayscale pixel values
     */
    rgbToGrayscale(imageData) {
        const { data, width, height } = imageData;
        const grayscale = new Float32Array(width * height);
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Luminance formula
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            grayscale[i / 4] = gray;
        }
        
        return grayscale;
    },

    /**
     * Apply High-Pass Filter to remove low-frequency components
     * This isolates texture details where AI artifacts are visible
     * @param {Float32Array} data - Grayscale image data
     * @param {number} width - Image width
     * @param {number} height - Image height
     * @returns {Float32Array} Filtered data
     */
    applyHighPassFilter(data, width, height) {
        const filtered = new Float32Array(data.length);
        
        // Simple 3x3 high-pass kernel
        const kernel = [
            [-1, -1, -1],
            [-1,  8, -1],
            [-1, -1, -1]
        ];
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sum = 0;
                
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixelIndex = (y + ky) * width + (x + kx);
                        sum += data[pixelIndex] * kernel[ky + 1][kx + 1];
                    }
                }
                
                filtered[y * width + x] = sum;
            }
        }
        
        return filtered;
    },

    /**
     * Normalize array values to 0-255 range
     * @param {Float32Array} data - Input data
     * @returns {Uint8ClampedArray} Normalized data
     */
    normalize(data) {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min;
        
        const normalized = new Uint8ClampedArray(data.length);
        
        for (let i = 0; i < data.length; i++) {
            normalized[i] = range > 0 ? ((data[i] - min) / range) * 255 : 0;
        }
        
        return normalized;
    },

    /**
     * Calculate magnitude from complex FFT result
     * @param {Float32Array} real - Real components
     * @param {Float32Array} imag - Imaginary components
     * @returns {Float32Array} Magnitude spectrum
     */
    calculateMagnitude(real, imag) {
        const magnitude = new Float32Array(real.length);
        
        for (let i = 0; i < real.length; i++) {
            magnitude[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        }
        
        return magnitude;
    },

    /**
     * Convert magnitude to logarithmic scale (dB)
     * @param {Float32Array} magnitude - Linear magnitude values
     * @returns {Float32Array} Log magnitude (dB)
     */
    toLogScale(magnitude) {
        const logMag = new Float32Array(magnitude.length);
        
        for (let i = 0; i < magnitude.length; i++) {
            logMag[i] = 20 * Math.log10(magnitude[i] + 1e-10); // Add small value to avoid log(0)
        }
        
        return logMag;
    },

    /**
     * Shift FFT result to center low frequencies
     * @param {Float32Array} data - FFT data
     * @param {number} width - Data width
     * @param {number} height - Data height
     * @returns {Float32Array} Shifted data
     */
    fftShift(data, width, height) {
        const shifted = new Float32Array(data.length);
        const halfWidth = Math.floor(width / 2);
        const halfHeight = Math.floor(height / 2);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const newX = (x + halfWidth) % width;
                const newY = (y + halfHeight) % height;
                shifted[newY * width + newX] = data[y * width + x];
            }
        }
        
        return shifted;
    },

    /**
     * Apply inferno colormap for visualization
     * @param {number} value - Normalized value (0-1)
     * @returns {Array} RGB color [r, g, b]
     */
    infernoColormap(value) {
        // Simplified inferno colormap
        const colormapData = [
            [0, 0, 4],
            [40, 11, 84],
            [101, 21, 110],
            [159, 42, 99],
            [212, 72, 66],
            [245, 125, 21],
            [250, 193, 39],
            [252, 255, 164]
        ];
        
        const index = Math.min(Math.floor(value * (colormapData.length - 1)), colormapData.length - 2);
        const t = (value * (colormapData.length - 1)) - index;
        
        const c1 = colormapData[index];
        const c2 = colormapData[index + 1];
        
        return [
            Math.round(c1[0] + (c2[0] - c1[0]) * t),
            Math.round(c1[1] + (c2[1] - c1[1]) * t),
            Math.round(c1[2] + (c2[2] - c1[2]) * t)
        ];
    },

    /**
     * Extract a frame from video at current time
     * @param {HTMLVideoElement} video - Video element
     * @param {number} targetSize - Target size for analysis (default 256)
     * @returns {ImageData} Frame image data
     */
    extractFrame(video, targetSize = 256) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Resize to target size for faster FFT
        canvas.width = targetSize;
        canvas.height = targetSize;
        
        // Draw video frame
        ctx.drawImage(video, 0, 0, targetSize, targetSize);
        
        return ctx.getImageData(0, 0, targetSize, targetSize);
    },

    /**
     * Format file size for display
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted size
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    },

    /**
     * Debounce function calls
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in ms
     * @returns {Function} Debounced function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};
