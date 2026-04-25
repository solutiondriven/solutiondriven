"""
FastAPI Backend for Screen Share Analysis
Handles WebSocket frame streaming and async processing
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
import base64
from typing import Optional, Set
from datetime import datetime
import logging
from collections import deque

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Micromax Screen Share API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connection manager for WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.frame_queue = deque(maxlen=10)  # Keep last 10 frames
        self.stats = {
            "frames_received": 0,
            "frames_processed": 0,
            "total_bytes": 0,
            "avg_frame_size": 0
        }

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"✅ Client connected. Active connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        logger.info(f"❌ Client disconnected. Active connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")
                disconnected.add(connection)
        
        for conn in disconnected:
            self.disconnect(conn)

    def add_frame(self, frame_data: dict):
        """Add frame to queue for analysis"""
        self.frame_queue.append(frame_data)
        self.stats["frames_received"] += 1
        
        # Update stats
        frame_size = len(frame_data.get("data", ""))
        self.stats["total_bytes"] += frame_size
        self.stats["avg_frame_size"] = self.stats["total_bytes"] / max(self.stats["frames_received"], 1)

    def get_stats(self) -> dict:
        """Get connection statistics"""
        return {
            **self.stats,
            "active_connections": len(self.active_connections),
            "queued_frames": len(self.frame_queue),
            "timestamp": datetime.now().isoformat()
        }


manager = ConnectionManager()


class FrameProcessor:
    """Async frame processing queue"""
    
    def __init__(self):
        self.processing_queue = asyncio.Queue()
        self.is_running = False

    async def start(self):
        """Start frame processor"""
        self.is_running = True
        asyncio.create_task(self._process_loop())
        logger.info("🚀 Frame processor started")

    async def stop(self):
        """Stop frame processor"""
        self.is_running = False
        logger.info("⏹️ Frame processor stopped")

    async def add_frame(self, frame_data: dict):
        """Add frame to processing queue"""
        await self.processing_queue.put(frame_data)

    async def _process_loop(self):
        """Main processing loop"""
        while self.is_running:
            try:
                # Get frame with timeout
                frame_data = await asyncio.wait_for(
                    self.processing_queue.get(), 
                    timeout=5.0
                )
                
                # Simulate analysis (replace with actual ML model)
                analysis = await self._analyze_frame(frame_data)
                
                # Broadcast results
                await manager.broadcast({
                    "type": "frame_analysis",
                    "frame_number": frame_data.get("frameNumber"),
                    "timestamp": frame_data.get("timestamp"),
                    "analysis": analysis,
                    "stats": manager.get_stats()
                })
                
                manager.stats["frames_processed"] += 1
                
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                logger.error(f"Processing error: {e}")

    async def _analyze_frame(self, frame_data: dict) -> dict:
        """
        Analyze frame data
        In production, this would:
        1. Decode the JPEG
        2. Send to vision model (GPT-4V, Claude Vision, etc.)
        3. Return structured analysis
        """
        await asyncio.sleep(0.1)  # Simulate processing
        
        return {
            "patterns": ["uptrend", "support_level"],
            "confidence": 0.85,
            "signals": ["buy"],
            "technical_levels": {
                "support": 67500,
                "resistance": 68500
            }
        }


processor = FrameProcessor()


@app.on_event("startup")
async def startup_event():
    """Initialize on startup"""
    await processor.start()
    logger.info("🎯 Micromax Screen Share API started")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    await processor.stop()
    logger.info("🛑 Micromax Screen Share API stopped")


@app.websocket("/ws/screen-share")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for screen share streaming
    
    Client sends frames like:
    {
        "type": "frame",
        "timestamp": 1234567890,
        "frameNumber": 1,
        "data": "base64_jpeg_data",
        "width": 1920,
        "height": 1080
    }
    """
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive frame from client
            data = await websocket.receive_text()
            frame_data = json.loads(data)
            
            if frame_data.get("type") == "frame":
                # Add to queue
                manager.add_frame(frame_data)
                await processor.add_frame(frame_data)
                
                # Send acknowledgment
                await websocket.send_json({
                    "type": "frame_ack",
                    "frameNumber": frame_data.get("frameNumber"),
                    "status": "received"
                })
                
                logger.debug(f"📸 Frame {frame_data.get('frameNumber')} received")
            
            elif frame_data.get("type") == "stats":
                # Client requesting stats
                await websocket.send_json({
                    "type": "stats",
                    "data": manager.get_stats()
                })
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "connections": manager.get_stats(),
        "timestamp": datetime.now().isoformat()
    }


@app.get("/stats")
async def get_stats():
    """Get current statistics"""
    return manager.get_stats()


@app.post("/analyze-image")
async def analyze_image(image_base64: str):
    """
    Analyze a single image
    
    In production, integrate with:
    - GPT-4 Vision API
    - Claude 3 Vision
    - Custom ML models
    """
    try:
        # Decode and process image
        analysis = await processor._analyze_frame({
            "data": image_base64,
            "frameNumber": 0,
            "timestamp": datetime.now().isoformat()
        })
        
        return {
            "success": True,
            "analysis": analysis
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
