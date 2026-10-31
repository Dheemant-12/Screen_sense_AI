# Automatic API Key Generation Guide

## Overview

Automatic API key generation is **possible but requires provider support**. Not all providers allow programmatic key creation at the user level.

## Provider Support Matrix

| Provider | Programmatic Key Creation | Method | Ease |
|----------|---------------------------|--------|------|
| **OpenAI** | ❌ NO | Admin only | Not available |
| **Groq** | ❌ NO | Admin only | Not available |
| **AWS** | ✅ YES | AWS SDK / CloudFormation | Medium |
| **Google Cloud** | ✅ YES | Google Cloud API | Medium |
| **Azure** | ✅ YES | Azure SDK | Medium |
| **Anthropic** | ❌ NO | Manual creation | Not available |
| **Local Ollama** | ✅ YES | Custom auth | Easy |

## Approaches for Automatic Key Generation

### Approach 1: AWS-Based (Recommended for Enterprise)

**Best for:** Systems using AWS Bedrock or AWS services

#### Prerequisites
- AWS Account with IAM permissions
- AWS SDK / CLI
- Secure credential storage

#### Solution: AWS Lambda + Secrets Manager

```python
# lambda-key-generator.py
import boto3
import json
import uuid
from datetime import datetime

iam_client = boto3.client('iam')
secrets_client = boto3.client('secretsmanager')

def generate_api_key():
    """Generate new AWS IAM access key"""
    user_name = f'api-user-{uuid.uuid4().hex[:8]}'
    
    try:
        # Create new IAM user
        iam_client.create_user(UserName=user_name)
        
        # Create access key
        response = iam_client.create_access_key(UserName=user_name)
        access_key = response['AccessKey']
        
        # Store in Secrets Manager
        secret_value = {
            'AccessKeyId': access_key['AccessKeyId'],
            'SecretAccessKey': access_key['SecretAccessKey'],
            'CreatedDate': datetime.now().isoformat(),
            'User': user_name
        }
        
        secrets_client.create_secret(
            Name=f'api-key-{user_name}',
            SecretString=json.dumps(secret_value)
        )
        
        return {
            'success': True,
            'accessKeyId': access_key['AccessKeyId'],
            'secretName': f'api-key-{user_name}'
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}

def lambda_handler(event, context):
    result = generate_api_key()
    return {
        'statusCode': 200 if result['success'] else 500,
        'body': json.dumps(result)
    }
```

**Deploy:**
```bash
# Package Lambda
zip lambda-function.zip lambda-key-generator.py

# Deploy to AWS
aws lambda create-function \
  --function-name ScreenSenseKeyGenerator \
  --runtime python3.11 \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-role \
  --handler lambda-key-generator.lambda_handler \
  --zip-file fileb://lambda-function.zip
```

**Trigger from n8n:**
```json
{
  "nodeType": "n8n-nodes-base.awsLambda",
  "action": "invoke",
  "functionName": "ScreenSenseKeyGenerator",
  "json": true
}
```

### Approach 2: Custom Backend Service (Recommended)

**Best for:** Multi-tenant applications

Create a micro-service that:
1. Monitors API usage
2. Detects quota approaching/exceeded
3. Requests new keys from provider (if API exists)
4. Stores keys securely
5. Rotates in Screen Sense via local endpoint

#### Node.js Microservice

```javascript
// key-generation-service.js
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const SCREEN_SENSE_ENDPOINT = 'http://127.0.0.1:8765/rotate-keys';
const ROTATION_SECRET = process.env.KEY_ROTATION_SECRET;

// Key pool storage (use real DB in production)
let keyPool = {
  openai: [],
  groq: [],
  bedrock: []
};

/**
 * Check API usage and auto-generate if needed
 */
app.post('/check-quota', async (req, res) => {
  const { provider, currentUsage, quotaLimit } = req.body;
  
  const usagePercent = (currentUsage / quotaLimit) * 100;
  
  if (usagePercent > 80) {
    console.log(`⚠️  ${provider} usage at ${usagePercent}%`);
    
    try {
      const newKey = await generateNewKey(provider);
      
      if (newKey) {
        // Store in pool
        keyPool[provider].push({
          key: newKey,
          createdAt: new Date(),
          status: 'active'
        });
        
        // Rotate to new key
        await rotateKey(provider, newKey);
        
        res.json({
          success: true,
          action: 'rotated',
          newKey: newKey.substring(0, 8) + '...',
          timestamp: new Date()
        });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  } else {
    res.json({
      success: true,
      action: 'no_rotation_needed',
      usage: `${usagePercent.toFixed(2)}%`
    });
  }
});

/**
 * Generate new API key (provider-specific)
 */
async function generateNewKey(provider) {
  switch (provider) {
    case 'openai':
      return await generateOpenAIKey();
    case 'groq':
      return await generateGroqKey();
    case 'bedrock':
      return await generateBedrockKey();
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

/**
 * OpenAI: Requires admin API (not standard)
 * Fallback: Use pre-generated key pool
 */
async function generateOpenAIKey() {
  const preGeneratedKeys = process.env.OPENAI_KEY_POOL?.split(',') || [];
  if (preGeneratedKeys.length === 0) {
    throw new Error('No pre-generated OpenAI keys available');
  }
  return preGeneratedKeys[0]; // In production, track which are used
}

/**
 * Groq: Similar to OpenAI - requires manual setup or admin API
 */
async function generateGroqKey() {
  const preGeneratedKeys = process.env.GROQ_KEY_POOL?.split(',') || [];
  if (preGeneratedKeys.length === 0) {
    throw new Error('No pre-generated Groq keys available');
  }
  return preGeneratedKeys[0];
}

/**
 * AWS Bedrock: Can be generated programmatically
 */
async function generateBedrockKey() {
  const AWS = require('aws-sdk');
  const iam = new AWS.IAM();
  
  try {
    const userName = `bedrock-key-${crypto.randomBytes(8).toString('hex')}`;
    
    // Create IAM user
    await iam.createUser({ UserName: userName }).promise();
    
    // Create access key
    const result = await iam.createAccessKey({ UserName: userName }).promise();
    
    return result.AccessKey.AccessKeyId + ':' + result.AccessKey.SecretAccessKey;
  } catch (err) {
    throw new Error(`Failed to generate Bedrock key: ${err.message}`);
  }
}

/**
 * Rotate key in Screen Sense app
 */
async function rotateKey(provider, newKey) {
  const payload = {};
  
  if (provider === 'openai') {
    payload.openaiKey = newKey;
  } else if (provider === 'groq') {
    payload.apiKey = newKey;
  }
  
  const response = await axios.post(SCREEN_SENSE_ENDPOINT, payload, {
    headers: {
      'x-rotation-secret': ROTATION_SECRET,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

app.listen(3001, () => {
  console.log('Key generation service running on port 3001');
});

module.exports = app;
```

**Environment Variables:**
```bash
KEY_ROTATION_SECRET=your_secret_here
OPENAI_KEY_POOL=sk-key1,sk-key2,sk-key3
GROQ_KEY_POOL=gsk_key1,gsk_key2,gsk_key3
AWS_ACCESS_KEY_ID=YOUR_AWS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET
```

**Start Service:**
```bash
node key-generation-service.js
```

### Approach 3: Pre-Rotation Pool (Simplest)

**Best for:** Small teams / development

Pre-generate multiple keys and store them securely:

```javascript
// Store multiple keys in electron-store
const store = new Store();

const keyPool = {
  openai: [
    { key: 'sk-key1', status: 'active', created: '2026-05-22' },
    { key: 'sk-key2', status: 'standby', created: '2026-05-22' },
    { key: 'sk-key3', status: 'standby', created: '2026-05-22' }
  ],
  groq: [
    { key: 'gsk_key1', status: 'active', created: '2026-05-22' },
    { key: 'gsk_key2', status: 'standby', created: '2026-05-22' }
  ]
};

store.set('keyPool', keyPool);

// Automatically rotate when error detected
function rotateOnError(provider, errorCode) {
  if (errorCode === 429) {
    const pool = store.get(`keyPool.${provider}`);
    const standbyKey = pool.find(k => k.status === 'standby');
    
    if (standbyKey) {
      // Mark current as used
      const activeIdx = pool.findIndex(k => k.status === 'active');
      pool[activeIdx].status = 'used';
      
      // Activate next
      standbyKey.status = 'active';
      
      store.set(`keyPool.${provider}`, pool);
      return standbyKey.key;
    }
  }
}
```

### Approach 4: n8n Workflow with Manual Key Addition

**Best for:** Teams without dev resources

Create an n8n workflow that:
1. Detects quota approaching (80%+)
2. Sends Slack/Email notification to admin
3. Admin manually adds pre-generated keys via webhook
4. Workflow automatically rotates to new key

```json
{
  "name": "Monitor Quota and Alert",
  "nodes": [
    {
      "type": "schedule",
      "parameters": {
        "interval": ["every", 1, "hour"]
      }
    },
    {
      "type": "httpRequest",
      "parameters": {
        "method": "GET",
        "url": "http://127.0.0.1:8765/key-usage"
      }
    },
    {
      "type": "if",
      "parameters": {
        "conditions": {
          "number": [
            {
              "comparator": "greaterThan",
              "value1": "{{ $json.usagePercent }}",
              "value2": 80
            }
          ]
        }
      }
    },
    {
      "type": "slack",
      "parameters": {
        "message": "⚠️ API key quota at {{ $json.usagePercent }}%. Please add new keys.",
        "channel": "#alerts"
      }
    }
  ]
}
```

## Recommended Implementation for Screen Sense

### Short Term (Now)
```javascript
// Use pre-generated key pool approach
// 1. Generate 5-10 keys manually for each provider
// 2. Store in Screen Sense app
// 3. Auto-rotate when quota approaches 80%
// 4. Alert user to generate more keys
```

### Medium Term (Weeks)
```javascript
// Implement key-generation-service.js microservice
// 1. Run as separate Node.js service
// 2. Monitor quota automatically
// 3. Manage key pool
// 4. Rotate to Screen Sense app on demand
```

### Long Term (Months)
```javascript
// Implement AWS-based solution
// 1. Use AWS Lambda for key generation
// 2. Use Secrets Manager for storage
// 3. Automatic provisioning and rotation
// 4. Audit logging and compliance
```

## Code to Add to Screen Sense

### Update main.js to support key pool checking

```javascript
// Add to startKeyRotationServer()
app.get('/key-usage', (req, res) => {
  const settings = store.get('settings') || {};
  const openaiKeys = parseApiKeys(settings.openaiKey);
  const groqKeys = parseApiKeys(settings.apiKey);
  
  res.json({
    openai: {
      total: openaiKeys.length,
      active: settings.openaiKeyIndex || 0,
      usagePercent: calculateUsage('openai')
    },
    groq: {
      total: groqKeys.length,
      active: settings.apiKeyIndex || 0,
      usagePercent: calculateUsage('groq')
    },
    timestamp: new Date()
  });
});

function calculateUsage(provider) {
  // Track API calls and return usage %
  // Requires adding call counting logic
  return 0; // Placeholder
}
```

## Summary

| Approach | Difficulty | Cost | Flexibility | Best For |
|----------|-----------|------|-------------|----------|
| Pre-pool | Easy | Low | Limited | Dev/testing |
| n8n alerts | Easy | Medium | Good | Small teams |
| Microservice | Medium | Medium | Excellent | Growing teams |
| AWS Lambda | Hard | Low | Excellent | Enterprise |

**For Screen Sense, I recommend:** Start with **Approach 3 (Pre-pool)**, then graduate to **Approach 2 (Microservice)** when you have multiple users.

Would you like me to implement any of these approaches in the Screen Sense codebase?
