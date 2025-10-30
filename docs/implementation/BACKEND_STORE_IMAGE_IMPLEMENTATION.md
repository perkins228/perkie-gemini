# Backend /store-image Endpoint Implementation Guide

## Issue Summary
The frontend is attempting to call `/store-image` endpoint which doesn't exist in the backend API, causing 404 errors.

## Required Endpoint Implementation

### Endpoint: POST /store-image
This endpoint should handle pet image uploads and return a permanent URL for the stored image.

### Request Format
```
POST /store-image
Content-Type: multipart/form-data

Fields:
- image: File (the image blob/file to upload)
- purpose: String ("original" or "processed_<effect>")
- session_id: String (unique session identifier)
- effect: String (the effect applied to the image)
```

### Expected Response
```json
{
  "url": "https://your-storage-service.com/path/to/stored/image.png",
  "success": true
}
```

### Implementation Options

#### Option 1: AWS S3 Storage
```python
@app.route('/store-image', methods=['POST'])
def store_image():
    try:
        image = request.files.get('image')
        purpose = request.form.get('purpose')
        session_id = request.form.get('session_id')
        effect = request.form.get('effect')
        
        if not image:
            return jsonify({'error': 'No image provided'}), 400
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = f"{session_id}_{purpose}_{timestamp}.{image.filename.split('.')[-1]}"
        
        # Upload to S3
        s3_client = boto3.client('s3')
        s3_client.upload_fileobj(
            image,
            'your-bucket-name',
            f"pet-images/{filename}",
            ExtraArgs={'ContentType': image.content_type}
        )
        
        # Return the URL
        url = f"https://your-bucket-name.s3.amazonaws.com/pet-images/{filename}"
        return jsonify({'url': url, 'success': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

#### Option 2: Local Storage (Development)
```python
import os
from werkzeug.utils import secure_filename

@app.route('/store-image', methods=['POST'])
def store_image():
    try:
        image = request.files.get('image')
        purpose = request.form.get('purpose')
        session_id = request.form.get('session_id')
        
        if not image:
            return jsonify({'error': 'No image provided'}), 400
        
        # Create upload directory if it doesn't exist
        upload_dir = os.path.join(app.static_folder, 'pet-uploads')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        filename = secure_filename(f"{session_id}_{purpose}_{timestamp}_{image.filename}")
        filepath = os.path.join(upload_dir, filename)
        
        # Save the file
        image.save(filepath)
        
        # Return the URL
        url = url_for('static', filename=f'pet-uploads/{filename}', _external=True)
        return jsonify({'url': url, 'success': True})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

#### Option 3: Cloudinary Integration
```python
import cloudinary
import cloudinary.uploader

@app.route('/store-image', methods=['POST'])
def store_image():
    try:
        image = request.files.get('image')
        purpose = request.form.get('purpose')
        session_id = request.form.get('session_id')
        effect = request.form.get('effect')
        
        if not image:
            return jsonify({'error': 'No image provided'}), 400
        
        # Upload to Cloudinary
        result = cloudinary.uploader.upload(
            image,
            folder="pet-images",
            public_id=f"{session_id}_{purpose}_{int(time.time())}",
            resource_type="image"
        )
        
        return jsonify({
            'url': result['secure_url'],
            'success': True
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
```

## Security Considerations

1. **File Validation**: Always validate file types and sizes
   ```python
   ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
   MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
   
   def allowed_file(filename):
       return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
   ```

2. **Rate Limiting**: Implement rate limiting to prevent abuse
   ```python
   from flask_limiter import Limiter
   
   limiter = Limiter(app, key_func=lambda: request.remote_addr)
   
   @limiter.limit("10 per minute")
   @app.route('/store-image', methods=['POST'])
   def store_image():
       # ... implementation
   ```

3. **Authentication**: Consider requiring authentication for uploads
   ```python
   @require_auth  # Your auth decorator
   @app.route('/store-image', methods=['POST'])
   def store_image():
       # ... implementation
   ```

## Temporary Frontend Solution
Until the backend endpoint is implemented, the frontend has been modified to use data URLs instead of server uploads. This avoids the 404 errors but has limitations:
- Data URLs are stored in memory
- Limited by browser memory constraints
- Not suitable for production use

## Next Steps
1. Choose a storage solution (S3, Cloudinary, etc.)
2. Implement the endpoint with proper error handling
3. Add file validation and security measures
4. Update the frontend to use the actual endpoint once ready
5. Test with various file sizes and formats