/**
 * Screen Share Service - Real-time Frame Streaming Architecture
 * 
 * Architecture:
 * 1. getDisplayMedia() → capture screen stream
 * 2. Canvas extraction → convert video to frames
 * 3. Frame diffing → only send changed pixels
 * 4. WebSocket → stream to backend
 * 5. Backend queue → async processing
 * 6. Vision model → chart analysis
 */

interface FrameDiffResult {
  hasChanged: boolean;
  diffPercentage: number;
  roiFrame: ImageData | null;
}

interface ScreenShareConfig {
  frameInterval: number; // ms between frames
  quality: number; // 0.3-0.8 (JPEG quality)
  diffThreshold: number; // 0-1 (% change to trigger send)
  roiMode: 'full' | 'chart' | 'auto'; // Capture region
}

export class ScreenShareService {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private previousFrame: ImageData | null = null;
  private ws: WebSocket | null = null;
  private frameIntervalId: number | null = null;
  private config: ScreenShareConfig;
  private isRecording = false;
  private frameCount = 0;
  private lastSentFrame = 0;
  private statsCallback: ((stats: { fps: number; sent: number; total: number }) => void) | null = null;
  private stopCallback: ((reason?: 'manual' | 'ended') => void) | null = null;
  private isStopping = false;

  constructor(config: Partial<ScreenShareConfig> = {}) {
    this.config = {
      frameInterval: 1000, // 1 frame per second by default
      quality: 0.5, // Moderate quality for faster transmission
      diffThreshold: 0.05, // 5% change triggers send
      roiMode: 'chart',
      ...config,
    };
  }

  /**
   * Start screen capture using getDisplayMedia() API
   */
  async startCapture(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'never',
          displaySurface: 'monitor',
        } as any,
        audio: false,
      });

      const videoTrack = this.stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stopCapture('ended');
        };
      }

      this.setupCanvas();
      this.setupVideo();
      console.log('✅ Screen capture started');
    } catch (error) {
      console.error('❌ Screen capture failed:', error);
      throw error;
    }
  }

  /**
   * Setup canvas for frame extraction
   */
  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    
    // Set canvas size from video
    if (this.stream) {
      const videoTrack = this.stream.getVideoTracks()[0];
      const settings = videoTrack.getSettings();
      this.canvas.width = settings.width || 1920;
      this.canvas.height = settings.height || 1080;
    }
  }

  /**
   * Setup video element to play stream
   */
  private setupVideo(): void {
    this.video = document.createElement('video');
    this.video.srcObject = this.stream;
    this.video.play();
  }

  /**
   * Extract current frame from video stream
   */
  private captureFrame(): ImageData | null {
    if (!this.video || !this.ctx || !this.canvas) return null;

    try {
      this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
      return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } catch (error) {
      console.error('Frame capture error:', error);
      return null;
    }
  }

  /**
   * Detect Region of Interest (chart area) to reduce data sent
   * This detects the trading view chart boundaries
   */
  private detectChartROI(imageData: ImageData): { x: number; y: number; width: number; height: number } {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Look for dark areas (chart typically has dark background)
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let chartPixels = 0;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const darkness = (r + g + b) / 3;

      // Detect dark chart area
      if (darkness < 100) {
        chartPixels++;
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }

    // Fallback to full screen if chart not detected
    if (chartPixels < width * height * 0.1) {
      return { x: 0, y: 0, width, height };
    }

    return {
      x: Math.max(0, minX - 10),
      y: Math.max(0, minY - 10),
      width: Math.min(width, maxX - minX + 20),
      height: Math.min(height, maxY - minY + 20),
    };
  }

  /**
   * Calculate frame difference percentage
   */
  private calculateFrameDiff(frame1: ImageData, frame2: ImageData): FrameDiffResult {
    if (!frame1 || !frame2) {
      return { hasChanged: true, diffPercentage: 1, roiFrame: frame2 };
    }

    const data1 = frame1.data;
    const data2 = frame2.data;
    let diffPixels = 0;
    const threshold = 15; // Color difference threshold

    for (let i = 0; i < data1.length; i += 4) {
      const rDiff = Math.abs(data1[i] - data2[i]);
      const gDiff = Math.abs(data1[i + 1] - data2[i + 1]);
      const bDiff = Math.abs(data1[i + 2] - data2[i + 2]);

      if (rDiff > threshold || gDiff > threshold || bDiff > threshold) {
        diffPixels++;
      }
    }

    const diffPercentage = diffPixels / (data1.length / 4);
    const roiData = this.config.roiMode !== 'full' ? this.detectChartROI(frame2) : null;
    const roiFrame = roiData
      ? this.ctx!.getImageData(roiData.x, roiData.y, roiData.width, roiData.height)
      : frame2;

    return {
      hasChanged: diffPercentage >= this.config.diffThreshold,
      diffPercentage,
      roiFrame,
    };
  }

  /**
   * Connect to WebSocket for frame streaming (optional)
   */
  connectWebSocket(url: string = 'ws://localhost:8000/ws/screen-share'): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('🔗 WebSocket connected');
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📩 Frame response:', data);
          } catch (e) {
            console.log('📩 Binary response received');
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Start continuous frame streaming and analysis
   */
  startStreaming(): void {
    if (this.isRecording) return;
    this.isRecording = true;
    this.frameCount = 0;
    this.lastSentFrame = 0;

    const captureAndSend = () => {
      try {
        const frame = this.captureFrame();
        if (!frame) return;

        this.frameCount++;

        // Check if frame changed
        const diff = this.calculateFrameDiff(this.previousFrame || frame, frame);
        this.previousFrame = frame;

        // Send if changed OR every 30 frames (fallback)
        if (diff.hasChanged || this.frameCount % 30 === 0) {
          this.sendFrame(diff.roiFrame || frame);
          this.lastSentFrame = this.frameCount;
        }

        // Update stats
        const fps = (this.lastSentFrame / (this.frameCount || 1)) * (1000 / this.config.frameInterval);
        this.statsCallback?.({
          fps: Math.round(fps * 10) / 10,
          sent: this.lastSentFrame,
          total: this.frameCount,
        });
      } catch (error) {
        console.error('Streaming error:', error);
      }
    };

    this.frameIntervalId = window.setInterval(captureAndSend, this.config.frameInterval);
  }

  /**
   * Send frame to backend via WebSocket
   */
  private sendFrame(imageData: ImageData): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    try {
      // Convert to high-quality JPEG for compression
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = imageData.width;
      tempCanvas.height = imageData.height;
      const tempCtx = tempCanvas.getContext('2d')!;
      tempCtx.putImageData(imageData, 0, 0);

      const jpegData = tempCanvas.toDataURL('image/jpeg', this.config.quality);

      this.ws.send(
        JSON.stringify({
          type: 'frame',
          timestamp: Date.now(),
          frameNumber: this.frameCount,
          data: jpegData,
          width: imageData.width,
          height: imageData.height,
        })
      );
    } catch (error) {
      console.error('Frame send error:', error);
    }
  }

  /**
   * Stop streaming and cleanup
   */
  stopStreaming(): void {
    this.isRecording = false;
    if (this.frameIntervalId) {
      clearInterval(this.frameIntervalId);
      this.frameIntervalId = null;
    }
  }

  stopCapture(reason: 'manual' | 'ended' = 'manual'): void {
    if (this.isStopping) {
      return;
    }

    this.isStopping = true;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      this.stream = null;
    }
    this.stopStreaming();
    this.ws?.close();
    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.previousFrame = null;
    this.stopCallback?.(reason);
    this.isStopping = false;
  }

  /**
   * Get streaming statistics
   */
  setStatsCallback(callback: (stats: { fps: number; sent: number; total: number }) => void): void {
    this.statsCallback = callback;
  }

  setStopCallback(callback: (reason?: 'manual' | 'ended') => void): void {
    this.stopCallback = callback;
  }

  getCaptureElements(): {
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
    video: HTMLVideoElement | null;
  } {
    return {
      canvas: this.canvas,
      ctx: this.ctx,
      video: this.video,
    };
  }

  /**
   * Update config for cost optimization
   */
  updateConfig(config: Partial<ScreenShareConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export default new ScreenShareService();
