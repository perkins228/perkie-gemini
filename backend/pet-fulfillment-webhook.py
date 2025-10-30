#!/usr/bin/env python3
"""
Pet Order Fulfillment Webhook Handler
Handles pet order data storage and retrieval for fulfillment purposes
"""

import json
import os
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging
from dataclasses import dataclass, asdict
from flask import Flask, request, jsonify, abort
import hashlib
import hmac

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Configuration
DATABASE_PATH = os.getenv('DATABASE_PATH', 'pet_fulfillment.db')
WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET', 'your_webhook_secret_here')
MAX_RETENTION_DAYS = int(os.getenv('MAX_RETENTION_DAYS', '90'))

@dataclass
class PetFulfillmentData:
    order_number: str
    pet_data: Dict
    fulfillment_status: str
    created_at: str
    updated_at: str
    notes: str = ""
    
class FulfillmentDatabase:
    def __init__(self, db_path: str):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize the database with required tables"""
        with sqlite3.connect(self.db_path) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS pet_orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_number TEXT UNIQUE NOT NULL,
                    pet_data TEXT NOT NULL,
                    fulfillment_status TEXT DEFAULT 'pending_processing',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    notes TEXT DEFAULT '',
                    processed_images_count INTEGER DEFAULT 0,
                    download_count INTEGER DEFAULT 0,
                    last_downloaded_at TEXT
                )
            ''')
            
            conn.execute('''
                CREATE TABLE IF NOT EXISTS fulfillment_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_number TEXT NOT NULL,
                    action TEXT NOT NULL,
                    old_status TEXT,
                    new_status TEXT,
                    notes TEXT,
                    timestamp TEXT NOT NULL,
                    ip_address TEXT,
                    user_agent TEXT
                )
            ''')
            
            conn.execute('''
                CREATE INDEX IF NOT EXISTS idx_order_number ON pet_orders(order_number);
                CREATE INDEX IF NOT EXISTS idx_fulfillment_status ON pet_orders(fulfillment_status);
                CREATE INDEX IF NOT EXISTS idx_created_at ON pet_orders(created_at);
            ''')
            
            conn.commit()
    
    def store_order(self, order_data: Dict) -> bool:
        """Store or update order data"""
        try:
            now = datetime.utcnow().isoformat()
            
            with sqlite3.connect(self.db_path) as conn:
                # Extract pet count for quick access
                pet_data = order_data.get('petData', {})
                pets = pet_data.get('pets', [])
                processed_images_count = len([p for p in pets if p.get('processedUrl')])
                
                conn.execute('''
                    INSERT OR REPLACE INTO pet_orders 
                    (order_number, pet_data, fulfillment_status, created_at, updated_at, processed_images_count)
                    VALUES (?, ?, ?, COALESCE((SELECT created_at FROM pet_orders WHERE order_number = ?), ?), ?, ?)
                ''', (
                    order_data['orderDataKey'],
                    json.dumps(order_data),
                    'pending_processing',
                    order_data['orderDataKey'],
                    now,
                    now,
                    processed_images_count
                ))
                
                # Log the action
                self.log_action(
                    order_data['orderDataKey'],
                    'order_stored',
                    None,
                    'pending_processing',
                    f"Order data received with {len(pets)} pets"
                )
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to store order {order_data.get('orderDataKey')}: {e}")
            return False
    
    def get_order(self, order_number: str) -> Optional[Dict]:
        """Get order data by order number"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute(
                    'SELECT * FROM pet_orders WHERE order_number = ?',
                    (order_number,)
                )
                row = cursor.fetchone()
                
                if row:
                    data = dict(row)
                    data['pet_data'] = json.loads(data['pet_data'])
                    return data
                    
        except Exception as e:
            logger.error(f"Failed to get order {order_number}: {e}")
            
        return None
    
    def get_orders_by_status(self, status: str = None) -> List[Dict]:
        """Get orders filtered by status"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.row_factory = sqlite3.Row
                
                if status:
                    cursor = conn.execute(
                        'SELECT * FROM pet_orders WHERE fulfillment_status = ? ORDER BY created_at DESC',
                        (status,)
                    )
                else:
                    cursor = conn.execute(
                        'SELECT * FROM pet_orders ORDER BY created_at DESC'
                    )
                
                orders = []
                for row in cursor.fetchall():
                    data = dict(row)
                    data['pet_data'] = json.loads(data['pet_data'])
                    orders.append(data)
                
                return orders
                
        except Exception as e:
            logger.error(f"Failed to get orders by status {status}: {e}")
            return []
    
    def update_status(self, order_number: str, new_status: str, notes: str = "", 
                     ip_address: str = None, user_agent: str = None) -> bool:
        """Update order fulfillment status"""
        try:
            # Get current status for logging
            current_order = self.get_order(order_number)
            if not current_order:
                return False
            
            old_status = current_order['fulfillment_status']
            now = datetime.utcnow().isoformat()
            
            with sqlite3.connect(self.db_path) as conn:
                # Update status
                conn.execute('''
                    UPDATE pet_orders 
                    SET fulfillment_status = ?, updated_at = ?, notes = ?
                    WHERE order_number = ?
                ''', (new_status, now, notes, order_number))
                
                # Log the action
                self.log_action(
                    order_number,
                    'status_updated',
                    old_status,
                    new_status,
                    notes,
                    ip_address,
                    user_agent
                )
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to update status for order {order_number}: {e}")
            return False
    
    def record_download(self, order_number: str, ip_address: str = None, 
                       user_agent: str = None) -> bool:
        """Record image download for tracking"""
        try:
            now = datetime.utcnow().isoformat()
            
            with sqlite3.connect(self.db_path) as conn:
                # Update download count and timestamp
                conn.execute('''
                    UPDATE pet_orders 
                    SET download_count = download_count + 1, last_downloaded_at = ?, updated_at = ?
                    WHERE order_number = ?
                ''', (now, now, order_number))
                
                # Log the action
                self.log_action(
                    order_number,
                    'images_downloaded',
                    None,
                    None,
                    "Images downloaded by staff",
                    ip_address,
                    user_agent
                )
                
                conn.commit()
                return True
                
        except Exception as e:
            logger.error(f"Failed to record download for order {order_number}: {e}")
            return False
    
    def log_action(self, order_number: str, action: str, old_status: str = None,
                  new_status: str = None, notes: str = "", ip_address: str = None,
                  user_agent: str = None):
        """Log fulfillment actions for audit trail"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute('''
                    INSERT INTO fulfillment_logs 
                    (order_number, action, old_status, new_status, notes, timestamp, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    order_number,
                    action,
                    old_status,
                    new_status,
                    notes,
                    datetime.utcnow().isoformat(),
                    ip_address,
                    user_agent
                ))
                conn.commit()
                
        except Exception as e:
            logger.error(f"Failed to log action for order {order_number}: {e}")
    
    def get_fulfillment_stats(self) -> Dict:
        """Get fulfillment statistics"""
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute('''
                    SELECT 
                        fulfillment_status,
                        COUNT(*) as count,
                        AVG(processed_images_count) as avg_images
                    FROM pet_orders 
                    GROUP BY fulfillment_status
                ''')
                
                status_stats = {}
                for row in cursor.fetchall():
                    status_stats[row[0]] = {
                        'count': row[1],
                        'avg_images': round(row[2], 1) if row[2] else 0
                    }
                
                # Get total stats
                cursor = conn.execute('''
                    SELECT 
                        COUNT(*) as total_orders,
                        SUM(processed_images_count) as total_images,
                        SUM(download_count) as total_downloads,
                        MIN(created_at) as oldest_order
                    FROM pet_orders
                ''')
                
                total_stats = cursor.fetchone()
                
                return {
                    'status_breakdown': status_stats,
                    'total_orders': total_stats[0],
                    'total_images': total_stats[1] or 0,
                    'total_downloads': total_stats[2] or 0,
                    'oldest_order': total_stats[3]
                }
                
        except Exception as e:
            logger.error(f"Failed to get fulfillment stats: {e}")
            return {}
    
    def cleanup_old_orders(self, days: int = None) -> int:
        """Clean up orders older than specified days"""
        if days is None:
            days = MAX_RETENTION_DAYS
            
        try:
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()
            
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    'DELETE FROM pet_orders WHERE created_at < ? AND fulfillment_status IN ("completed", "shipped")',
                    (cutoff_date,)
                )
                
                deleted_count = cursor.rowcount
                
                # Also clean up old logs
                cursor = conn.execute(
                    'DELETE FROM fulfillment_logs WHERE timestamp < ?',
                    (cutoff_date,)
                )
                
                conn.commit()
                
                logger.info(f"Cleaned up {deleted_count} old orders")
                return deleted_count
                
        except Exception as e:
            logger.error(f"Failed to cleanup old orders: {e}")
            return 0

# Initialize database
db = FulfillmentDatabase(DATABASE_PATH)

def verify_webhook_signature(data: bytes, signature: str) -> bool:
    """Verify webhook signature"""
    if not WEBHOOK_SECRET or not signature:
        return True  # Skip verification in development
    
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        data,
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(f"sha256={expected_signature}", signature)

@app.route('/webhooks/pet-order-fulfillment', methods=['POST'])
def handle_pet_order_webhook():
    """Handle incoming pet order data from frontend"""
    try:
        # Verify signature
        signature = request.headers.get('X-Hub-Signature-256')
        if not verify_webhook_signature(request.data, signature):
            logger.warning(f"Invalid webhook signature from {request.remote_addr}")
            abort(401)
        
        data = request.get_json()
        if not data:
            abort(400, "No JSON data provided")
        
        # Validate required fields
        if 'orderDataKey' not in data or 'petData' not in data:
            abort(400, "Missing required fields")
        
        # Store order data
        success = db.store_order(data)
        
        if success:
            logger.info(f"Stored pet order data for {data['orderDataKey']}")
            return jsonify({'status': 'success', 'message': 'Order data stored'})
        else:
            abort(500, "Failed to store order data")
            
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        abort(500, str(e))

@app.route('/webhooks/pet-order-fulfillment/<order_number>', methods=['GET'])
def get_order_data(order_number: str):
    """Get order data for fulfillment"""
    try:
        order_data = db.get_order(order_number)
        
        if order_data:
            return jsonify(order_data)
        else:
            abort(404, "Order not found")
            
    except Exception as e:
        logger.error(f"Error getting order {order_number}: {e}")
        abort(500, str(e))

@app.route('/webhooks/pet-order-fulfillment', methods=['GET'])
def get_all_orders():
    """Get all orders or filter by status"""
    try:
        status = request.args.get('status')
        orders = db.get_orders_by_status(status)
        
        return jsonify(orders)
        
    except Exception as e:
        logger.error(f"Error getting orders: {e}")
        abort(500, str(e))

@app.route('/api/fulfillment/orders/<order_number>/status', methods=['PUT'])
def update_order_status(order_number: str):
    """Update order fulfillment status"""
    try:
        data = request.get_json()
        if not data or 'status' not in data:
            abort(400, "Status is required")
        
        new_status = data['status']
        notes = data.get('notes', '')
        
        success = db.update_status(
            order_number,
            new_status,
            notes,
            request.remote_addr,
            request.headers.get('User-Agent')
        )
        
        if success:
            return jsonify({'status': 'success', 'message': 'Status updated'})
        else:
            abort(404, "Order not found")
            
    except Exception as e:
        logger.error(f"Error updating status for {order_number}: {e}")
        abort(500, str(e))

@app.route('/api/fulfillment/orders/<order_number>/download', methods=['POST'])
def record_download(order_number: str):
    """Record image download"""
    try:
        success = db.record_download(
            order_number,
            request.remote_addr,
            request.headers.get('User-Agent')
        )
        
        if success:
            return jsonify({'status': 'success', 'message': 'Download recorded'})
        else:
            abort(404, "Order not found")
            
    except Exception as e:
        logger.error(f"Error recording download for {order_number}: {e}")
        abort(500, str(e))

@app.route('/api/fulfillment/stats', methods=['GET'])
def get_fulfillment_stats():
    """Get fulfillment statistics"""
    try:
        stats = db.get_fulfillment_stats()
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Error getting stats: {e}")
        abort(500, str(e))

@app.route('/api/fulfillment/cleanup', methods=['POST'])
def cleanup_old_data():
    """Clean up old fulfillment data"""
    try:
        data = request.get_json() or {}
        days = data.get('days', MAX_RETENTION_DAYS)
        
        deleted_count = db.cleanup_old_orders(days)
        
        return jsonify({
            'status': 'success',
            'message': f'Cleaned up {deleted_count} old orders'
        })
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        abort(500, str(e))

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        # Test database connection
        db.get_fulfillment_stats()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'connected'
        })
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    # Development server
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)), debug=True)