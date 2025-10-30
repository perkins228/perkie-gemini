"""
Enhanced Progress Manager
Provides detailed progress tracking for multi-stage processing
"""

import time
import json
import asyncio
import logging
from typing import Dict, Optional, List, Any
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class EnhancedProgressManager:
    """Enhanced progress manager with detailed stage tracking"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_states: Dict[str, Dict[str, Any]] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Connect new WebSocket session"""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_states[session_id] = {
            'start_time': time.time(),
            'stages': [],
            'current_stage': None,
            'total_progress': 0
        }
        logger.info(f"Enhanced WebSocket connected: {session_id}")
    
    def disconnect(self, session_id: str):
        """Disconnect WebSocket session"""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.session_states:
            del self.session_states[session_id]
        logger.info(f"Enhanced WebSocket disconnected: {session_id}")
    
    async def send_stage_progress(
        self,
        session_id: str,
        stage: str,
        progress: int,
        message: str,
        stage_details: Optional[Dict[str, Any]] = None,
        eta_seconds: Optional[int] = None
    ):
        """Send detailed progress update for a specific stage"""
        if session_id not in self.active_connections:
            return
        
        try:
            # Update session state
            if session_id in self.session_states:
                session_state = self.session_states[session_id]
                session_state['current_stage'] = stage
                session_state['total_progress'] = progress
                
                # Add stage to history if new
                if not session_state['stages'] or session_state['stages'][-1]['stage'] != stage:
                    session_state['stages'].append({
                        'stage': stage,
                        'start_time': time.time(),
                        'initial_message': message
                    })
            
            # Prepare progress data
            data = {
                "type": "stage_progress",
                "session_id": session_id,
                "stage": stage,
                "progress": progress,
                "message": message,
                "timestamp": time.time(),
                "eta_seconds": eta_seconds,
                "stage_details": stage_details or {}
            }
            
            # Add session timing info
            if session_id in self.session_states:
                session_state = self.session_states[session_id]
                data["session_info"] = {
                    "total_elapsed": time.time() - session_state['start_time'],
                    "stages_completed": len([s for s in session_state['stages'] if s.get('completed', False)]),
                    "current_stage_elapsed": time.time() - session_state['stages'][-1]['start_time'] if session_state['stages'] else 0
                }
            
            await self.active_connections[session_id].send_text(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Failed to send progress to {session_id}: {e}")
            self.disconnect(session_id)
    
    async def send_progress(
        self,
        session_id: str,
        progress: int,
        message: str,
        stage: str = "processing"
    ):
        """
        Simple progress update method for backward compatibility
        
        Args:
            session_id: Session identifier
            progress: Progress percentage (0-100)
            message: Progress message
            stage: Processing stage name
        """
        await self.send_stage_progress(session_id, stage, progress, message)
    
    async def send_cache_info(
        self,
        session_id: str,
        cache_type: str,
        hit: bool,
        details: Optional[Dict[str, Any]] = None
    ):
        """Send cache hit/miss information"""
        if session_id not in self.active_connections:
            return
        
        try:
            data = {
                "type": "cache_info",
                "session_id": session_id,
                "cache_type": cache_type,
                "hit": hit,
                "details": details or {},
                "timestamp": time.time()
            }
            
            await self.active_connections[session_id].send_text(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Failed to send cache info to {session_id}: {e}")
    
    async def send_effect_progress(
        self,
        session_id: str,
        effect_name: str,
        effect_index: int,
        total_effects: int,
        status: str,
        processing_time: Optional[float] = None,
        cache_hit: bool = False
    ):
        """Send progress update for individual effect processing"""
        if session_id not in self.active_connections:
            return
        
        try:
            # Calculate progress based on effect position
            base_progress = 40  # Effects start at 40%
            effect_progress = int(base_progress + ((effect_index + 1) / total_effects) * 45)
            
            data = {
                "type": "effect_progress",
                "session_id": session_id,
                "effect": {
                    "name": effect_name,
                    "index": effect_index,
                    "total": total_effects,
                    "status": status,
                    "processing_time": processing_time,
                    "cache_hit": cache_hit
                },
                "progress": effect_progress,
                "message": f"Effect {effect_index + 1}/{total_effects}: {effect_name} ({status})",
                "timestamp": time.time()
            }
            
            await self.active_connections[session_id].send_text(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Failed to send effect progress to {session_id}: {e}")
    
    async def send_performance_metrics(
        self,
        session_id: str,
        metrics: Dict[str, Any]
    ):
        """Send performance metrics update"""
        if session_id not in self.active_connections:
            return
        
        try:
            data = {
                "type": "performance_metrics",
                "session_id": session_id,
                "metrics": metrics,
                "timestamp": time.time()
            }
            
            await self.active_connections[session_id].send_text(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Failed to send performance metrics to {session_id}: {e}")
    
    async def send_completion_summary(
        self,
        session_id: str,
        success: bool,
        total_time: float,
        results_summary: Dict[str, Any],
        cache_summary: Dict[str, Any]
    ):
        """Send completion summary with all processing details"""
        if session_id not in self.active_connections:
            return
        
        try:
            session_state = self.session_states.get(session_id, {})
            
            data = {
                "type": "completion_summary",
                "session_id": session_id,
                "success": success,
                "total_time": total_time,
                "results": results_summary,
                "cache": cache_summary,
                "session_summary": {
                    "total_elapsed": time.time() - session_state.get('start_time', time.time()),
                    "stages_completed": len(session_state.get('stages', [])),
                    "stages_detail": session_state.get('stages', [])
                },
                "timestamp": time.time()
            }
            
            await self.active_connections[session_id].send_text(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Failed to send completion summary to {session_id}: {e}")
    
    async def send_error(
        self,
        session_id: str,
        error_stage: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None
    ):
        """Send error information"""
        if session_id not in self.active_connections:
            return
        
        try:
            data = {
                "type": "error",
                "session_id": session_id,
                "error": {
                    "stage": error_stage,
                    "message": error_message,
                    "details": error_details or {}
                },
                "timestamp": time.time()
            }
            
            await self.active_connections[session_id].send_text(json.dumps(data))
            
        except Exception as e:
            logger.error(f"Failed to send error to {session_id}: {e}")
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get session information"""
        return self.session_states.get(session_id)
    
    def get_active_sessions(self) -> List[str]:
        """Get list of active session IDs"""
        return list(self.active_connections.keys())
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics"""
        return {
            "active_connections": len(self.active_connections),
            "total_sessions": len(self.session_states),
            "sessions": [
                {
                    "session_id": session_id,
                    "elapsed_time": time.time() - state.get('start_time', time.time()),
                    "current_stage": state.get('current_stage'),
                    "progress": state.get('total_progress', 0)
                }
                for session_id, state in self.session_states.items()
            ]
        }

# Create progress callback factory for integrated processor
def create_progress_callback(progress_manager: EnhancedProgressManager, session_id: str):
    """Create progress callback function for use with integrated processor"""
    
    async def progress_callback(stage: str, progress: int, message: str, **kwargs):
        """Progress callback function"""
        
        # Handle different stage types
        if stage == "upload":
            await progress_manager.send_stage_progress(
                session_id, "upload", progress, message,
                stage_details={"type": "file_processing"},
                eta_seconds=kwargs.get('eta_seconds', 15)
            )
            
        elif stage == "cache_check":
            await progress_manager.send_stage_progress(
                session_id, "cache_check", progress, message,
                stage_details={"type": "cache_lookup"},
                eta_seconds=kwargs.get('eta_seconds', 2)
            )
            
        elif stage == "cache_hit":
            await progress_manager.send_cache_info(
                session_id, "background_removal", True,
                details={"time_saved": "~5-10 seconds"}
            )
            await progress_manager.send_stage_progress(
                session_id, "cache_hit", progress, message,
                stage_details={"type": "cache_hit"},
                eta_seconds=1
            )
            
        elif stage == "bg_removal":
            await progress_manager.send_stage_progress(
                session_id, "background_removal", progress, message,
                stage_details={"type": "inspirenet_processing"},
                eta_seconds=kwargs.get('eta_seconds', 8)
            )
            
        elif stage == "effects_start":
            await progress_manager.send_stage_progress(
                session_id, "effects_processing", progress, message,
                stage_details={"type": "effects_pipeline"},
                eta_seconds=kwargs.get('eta_seconds', 5)
            )
            
        elif stage == "effects_processing":
            await progress_manager.send_stage_progress(
                session_id, "effects_processing", progress, message,
                stage_details={"type": "individual_effect"},
                eta_seconds=kwargs.get('eta_seconds', 2)
            )
            
        elif stage == "complete":
            await progress_manager.send_stage_progress(
                session_id, "complete", progress, message,
                stage_details={"type": "finalization"},
                eta_seconds=0
            )
        
        else:
            # Generic progress update
            await progress_manager.send_stage_progress(
                session_id, stage, progress, message,
                eta_seconds=kwargs.get('eta_seconds')
            )
    
    return progress_callback 