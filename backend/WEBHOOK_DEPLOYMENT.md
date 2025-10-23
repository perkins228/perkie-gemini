# Pet Fulfillment Webhook Deployment Guide

## Overview
This guide covers deploying the pet fulfillment webhook system to handle order data backup and staff access.

## System Requirements

### Python Environment
- Python 3.8+
- Flask
- SQLite3 (or PostgreSQL for production)

### Infrastructure Options
1. **Google Cloud Run** (Recommended)
2. **Heroku**
3. **AWS Lambda + API Gateway**
4. **VPS/Dedicated Server**

## Deployment Options

### Option 1: Google Cloud Run (Recommended)

#### Prerequisites
- Google Cloud account
- gcloud CLI installed

#### Steps

1. **Create Dockerfile**
```dockerfile
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY pet-fulfillment-webhook.py .

ENV PORT=8080
ENV DATABASE_PATH=/data/pet_fulfillment.db

# Create data directory
RUN mkdir -p /data

EXPOSE 8080

CMD ["python", "pet-fulfillment-webhook.py"]
```

2. **Create requirements.txt**
```txt
Flask==2.3.3
gunicorn==21.2.0
```

3. **Deploy to Cloud Run**
```bash
# Build and deploy
gcloud run deploy pet-fulfillment-webhook \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="WEBHOOK_SECRET=your_secure_secret_here" \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10
```

4. **Configure Domain (Optional)**
```bash
# Map custom domain
gcloud run domain-mappings create \
  --service=pet-fulfillment-webhook \
  --domain=fulfillment-api.perkieprints.com \
  --region=us-central1
```

### Option 2: Heroku

#### Steps

1. **Create Procfile**
```
web: gunicorn pet-fulfillment-webhook:app
```

2. **Create runtime.txt**
```
python-3.9.16
```

3. **Deploy**
```bash
# Create Heroku app
heroku create pet-fulfillment-api

# Set environment variables
heroku config:set WEBHOOK_SECRET=your_secure_secret_here
heroku config:set DATABASE_URL=sqlite:///pet_fulfillment.db

# Deploy
git push heroku main
```

### Option 3: AWS Lambda

#### Create serverless.yml
```yaml
service: pet-fulfillment-webhook

provider:
  name: aws
  runtime: python3.9
  region: us-east-1
  environment:
    WEBHOOK_SECRET: ${env:WEBHOOK_SECRET}
    DATABASE_PATH: /tmp/pet_fulfillment.db

functions:
  webhook:
    handler: pet-fulfillment-webhook.app
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors: true

plugins:
  - serverless-python-requirements
  - serverless-wsgi

custom:
  wsgi:
    app: pet-fulfillment-webhook.app
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port | 5000 | No |
| `DATABASE_PATH` | SQLite database path | pet_fulfillment.db | No |
| `WEBHOOK_SECRET` | Webhook signature verification | None | Yes |
| `MAX_RETENTION_DAYS` | Data retention period | 90 | No |

### Database Setup

#### SQLite (Development)
```bash
# Database is created automatically on first run
python pet-fulfillment-webhook.py
```

#### PostgreSQL (Production)
```python
# Update database URL in code
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://user:pass@host:port/db')
```

## Frontend Integration

### Update Shopify Theme

1. **Add webhook sync script to theme**
```liquid
<!-- In theme.liquid -->
<script src="{{ 'shopify-order-metafields-sync.js' | asset_url }}" defer></script>
```

2. **Configure webhook endpoint**
```javascript
// In shopify-order-metafields-sync.js
const WEBHOOK_ENDPOINT = 'https://your-webhook-url.com/webhooks/pet-order-fulfillment';
```

3. **Add fulfillment dashboard page**
```liquid
<!-- Create pages/pet-fulfillment-dashboard.liquid -->
<!-- Use the template provided in the implementation -->
```

## Security Configuration

### Webhook Signature Verification
```bash
# Generate secure secret
openssl rand -hex 32
```

### Access Control
```javascript
// Configure dashboard access code
const DASHBOARD_ACCESS_CODE = 'your_secure_access_code';
```

### CORS Settings (if needed)
```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=['https://perkieprints.com'])
```

## Monitoring & Logging

### Health Check Endpoint
```bash
curl https://your-webhook-url.com/health
```

### Log Monitoring
```bash
# Google Cloud Run
gcloud logs read --service=pet-fulfillment-webhook --limit=50

# Heroku
heroku logs --tail --app=pet-fulfillment-api
```

### Uptime Monitoring
Set up monitoring for:
- `/health` endpoint
- Response time < 2s
- 99.9% uptime target

## Backup & Recovery

### Database Backup
```bash
# SQLite backup
sqlite3 pet_fulfillment.db ".backup backup_$(date +%Y%m%d).db"

# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Automated Backups
```bash
# Add to crontab for daily backups
0 2 * * * /path/to/backup_script.sh
```

## Testing

### Local Testing
```bash
# Start webhook server
python pet-fulfillment-webhook.py

# Test endpoints
curl -X POST http://localhost:5000/webhooks/pet-order-fulfillment \
  -H "Content-Type: application/json" \
  -d '{"orderDataKey":"test_123","petData":{"pets":[]}}'

curl http://localhost:5000/health
```

### Production Testing
```bash
# Test webhook endpoint
curl -X POST https://your-webhook-url.com/webhooks/pet-order-fulfillment \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=YOUR_SIGNATURE" \
  -d '{"orderDataKey":"test_123","petData":{"pets":[]}}'
```

## Performance Optimization

### Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_order_number ON pet_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_fulfillment_status ON pet_orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_created_at ON pet_orders(created_at);
```

### Caching
```python
# Add Redis caching for frequently accessed data
import redis

redis_client = redis.Redis(host='localhost', port=6379, db=0)
```

### Rate Limiting
```python
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
```

## Troubleshooting

### Common Issues

#### Webhook not receiving data
1. Check webhook URL is correct
2. Verify CORS settings
3. Check webhook secret configuration
4. Monitor server logs

#### Database errors
1. Check database permissions
2. Verify connection string
3. Ensure sufficient disk space
4. Monitor database logs

#### High latency
1. Optimize database queries
2. Add caching layer
3. Scale server resources
4. Monitor performance metrics

### Debugging Commands
```bash
# Check server status
curl -I https://your-webhook-url.com/health

# View recent logs
gcloud logs read --service=pet-fulfillment-webhook --limit=10

# Test database connection
sqlite3 pet_fulfillment.db "SELECT COUNT(*) FROM pet_orders;"
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer for multiple instances
- Shared database (PostgreSQL/MySQL)
- Stateless webhook handlers

### Vertical Scaling
- Increase CPU/memory allocation
- Optimize database performance
- Use connection pooling

### Data Growth
- Implement data archival
- Monitor storage usage
- Set up automated cleanup

## Support & Maintenance

### Regular Tasks
- Monitor webhook health
- Review error logs
- Update dependencies
- Backup database
- Clean up old data

### Emergency Procedures
1. **Service Down**: Check health endpoint, restart service
2. **Data Loss**: Restore from backup, check localStorage fallback
3. **High Load**: Scale resources, implement rate limiting
4. **Security Issue**: Rotate secrets, review access logs