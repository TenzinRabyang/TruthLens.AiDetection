/**
 * FFT Visualization
 * Renders FFT magnitude spectrum as heatmap
 */

class FFTVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvas();
    }

    setupCanvas() {
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        const size = Math.min(container.clientWidth, container.clientHeight);

        this.canvas.width = size;
        this.canvas.height = size;

        // Set high DPI
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = size * dpr;
        this.canvas.height = size * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = size + 'px';
        this.canvas.style.height = size + 'px';
    }

    /**
     * Render FFT magnitude spectrum as heatmap
     * @param {Float32Array} magnitude - FFT magnitude data
     * @param {number} width - Data width
     * @param {number} height - Data height
     */
    render(magnitude, width, height) {
        const canvasSize = this.canvas.width / (window.devicePixelRatio || 1);

        // Clear canvas
        this.ctx.fillStyle = '#12121a';
        this.ctx.fillRect(0, 0, canvasSize, canvasSize);

        // Normalize magnitude for visualization
        const normalized = Utils.normalize(magnitude);

        // Create image data
        const imageData = this.ctx.createImageData(width, height);

        for (let i = 0; i < normalized.length; i++) {
            const value = normalized[i] / 255;
            const color = Utils.infernoColormap(value);

            imageData.data[i * 4] = color[0];
            imageData.data[i * 4 + 1] = color[1];
            imageData.data[i * 4 + 2] = color[2];
            imageData.data[i * 4 + 3] = 255;
        }

        // Create temporary canvas for scaling
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // Draw scaled image
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.drawImage(tempCanvas, 0, 0, canvasSize, canvasSize);

        // Add center crosshair
        this.drawCrosshair(canvasSize);

        // Add labels
        this.drawLabels(canvasSize);
    }

    /**
     * Draw center crosshair to mark low-frequency center
     * @param {number} size - Canvas size
     */
    drawCrosshair(size) {
        const center = size / 2;
        const crossSize = 20;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;

        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(center - crossSize, center);
        this.ctx.lineTo(center + crossSize, center);
        this.ctx.stroke();

        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(center, center - crossSize);
        this.ctx.lineTo(center, center + crossSize);
        this.ctx.stroke();

        // Center circle
        this.ctx.beginPath();
        this.ctx.arc(center, center, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.fill();
    }

    /**
     * Draw frequency labels
     * @param {number} size - Canvas size
     */
    drawLabels(size) {
        this.ctx.font = '11px Inter, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.textAlign = 'center';

        // Center label
        this.ctx.fillText('Low Freq', size / 2, size / 2 - 30);

        // Edge labels
        this.ctx.save();
        this.ctx.textAlign = 'left';
        this.ctx.fillText('High Freq', 10, 20);
        this.ctx.restore();
    }

    /**
     * Show placeholder when no data
     */
    showPlaceholder() {
        const size = this.canvas.width / (window.devicePixelRatio || 1);

        this.ctx.fillStyle = '#12121a';
        this.ctx.fillRect(0, 0, size, size);

        this.ctx.font = '16px Inter, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('Upload and analyze a video', size / 2, size / 2 - 10);
        this.ctx.fillText('to see FFT spectrum', size / 2, size / 2 + 10);
    }

    /**
     * Animate transition when showing new data
     */
    async animateIn() {
        this.canvas.style.opacity = '0';
        this.canvas.style.transform = 'scale(0.95)';

        await new Promise(resolve => setTimeout(resolve, 50));

        this.canvas.style.transition = 'all 0.5s ease';
        this.canvas.style.opacity = '1';
        this.canvas.style.transform = 'scale(1)';
    }
}
