#!/usr/bin/env node

/**
 * n8n Configuration & Workflow Helper
 * Validates and helps with n8n integration tasks
 * 
 * Usage:
 *   node scripts/load-n8n-config.js --validate-workflow
 *   node scripts/load-n8n-config.js --validate-config
 *   node scripts/load-n8n-config.js --export-env
 *   node scripts/load-n8n-config.js --test-rotation
 *   node scripts/load-n8n-config.js --export-credentials
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG_PATH = path.join(__dirname, '../n8n-bedrock-config.json');
const WORKFLOW_PATH = path.join(__dirname, '../n8n-bedrock-workflow.json');
const CREDENTIALS_PATH = path.join(__dirname, '../n8n-credentials-template.json');

class N8nHelper {
  constructor() {
    this.config = null;
    this.workflow = null;
    this.credentials = null;
  }

  /**
   * Load and validate workflow file
   */
  validateWorkflow() {
    try {
      const raw = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
      this.workflow = JSON.parse(raw);

      const required = ['nodes', 'connections', 'name'];
      const missing = required.filter(key => !this.workflow[key]);

      if (missing.length > 0) {
        console.error(`✗ Workflow missing required fields: ${missing.join(', ')}`);
        return false;
      }

      console.log('✓ Workflow file is valid');
      console.log(`  Name: ${this.workflow.name}`);
      console.log(`  Nodes: ${this.workflow.nodes.length}`);
      console.log(`  Active: ${this.workflow.active ? 'Yes' : 'No'}`);
      console.log('\nNodes in workflow:');
      this.workflow.nodes.forEach((node, idx) => {
        console.log(`  [${idx}] ${node.name} (type: ${node.type})`);
      });

      return true;
    } catch (err) {
      console.error('✗ Workflow validation failed:', err.message);
      return false;
    }
  }

  /**
   * Load and validate config file
   */
  validateConfig() {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      this.config = JSON.parse(raw);

      console.log('✓ Config file is valid (reference document)');
      console.log(`  Credentials defined: ${Object.keys(this.config.n8nCredentials).length}`);
      console.log(`  Rotation rules: ${this.config.rotationRules.length}`);
      console.log(`  API key providers: ${Object.keys(this.config.apiKeyPool).length}`);

      return true;
    } catch (err) {
      console.error('✗ Config validation failed:', err.message);
      return false;
    }
  }

  /**
   * Export config as environment variables (.env format)
   */
  exportEnv() {
    if (!this.config) {
      try {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        this.config = JSON.parse(raw);
      } catch (err) {
        console.error('✗ Failed to load config:', err.message);
        return;
      }
    }

    let envContent = '# Auto-generated from n8n-bedrock-config.json\n';
    envContent += `# Generated: ${new Date().toISOString()}\n\n`;

    Object.entries(this.config.environmentVariables).forEach(([key, value]) => {
      if (value.includes('YOUR_')) {
        envContent += `# TODO: Replace with actual value\n`;
      }
      envContent += `${key}=${value}\n`;
    });

    const envPath = path.join(__dirname, '../.env.n8n');
    fs.writeFileSync(envPath, envContent);
    console.log(`✓ Environment variables exported to ${envPath}`);
    console.log('⚠ Warning: Replace all YOUR_* placeholders before using\n');
  }

  /**
   * Export credentials template
   */
  exportCredentials() {
    try {
      const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      const creds = JSON.parse(raw);

      console.log('\n=== Credentials Template ===\n');
      creds.credentials.forEach(cred => {
        console.log(`${cred.name}:`);
        console.log(`  type: ${cred.type}`);
        console.log(`  data: ${JSON.stringify(cred.data, null, 2)}`);
      });

      console.log('\n=== Environment Variables ===\n');
      Object.entries(creds.environment).forEach(([key, val]) => {
        const display = val.includes('YOUR_') ? val : val.substring(0, 20) + '...';
        console.log(`${key}=${display}`);
      });
    } catch (err) {
      console.error('✗ Failed to load credentials:', err.message);
    }
  }

  /**
   * Test connection to local key rotation endpoint
   */
  async testRotation() {
    console.log('\n=== Testing Key Rotation Endpoint ===\n');

    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      this.config = JSON.parse(raw);
    } catch (err) {
      console.error('✗ Failed to load config:', err.message);
      return false;
    }

    const endpoint = this.config.keyRotationPolicy.rotationEndpoint;
    const secret = this.config.keyRotationPolicy.rotationSecret;

    if (!secret || secret.includes('YOUR_')) {
      console.error('✗ Rotation secret not configured');
      console.log('  Set KEY_ROTATION_SECRET first');
      return false;
    }

    return new Promise((resolve) => {
      const options = {
        method: 'POST',
        headers: {
          'x-rotation-secret': secret,
          'Content-Type': 'application/json'
        }
      };

      const testPayload = JSON.stringify({
        openaiKey: 'sk-test-key',
        apiKey: 'gsk-test-key'
      });

      const req = http.request(endpoint, options, (res) => {
        console.log(`Response status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log('✓ Key rotation endpoint is responsive');
        } else if (res.statusCode === 401) {
          console.error('✗ Authentication failed (invalid secret)');
        } else {
          console.error(`✗ Unexpected status: ${res.statusCode}`);
        }
        resolve(res.statusCode === 200 || res.statusCode === 401);
      });

      req.on('error', (err) => {
        console.error('✗ Connection failed:', err.message);
        console.log('  Is the Screen Sense app running? (npm start)');
        resolve(false);
      });

      req.write(testPayload);
      req.end();
    });
  }

  /**
   * List all Bedrock models
   */
  listModels() {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      this.config = JSON.parse(raw);

      console.log('\n=== Available Bedrock Models ===\n');
      this.config.bedrockModels.models.forEach(model => {
        console.log(`${model.name}`);
        console.log(`  ID: ${model.id}`);
        console.log(`  Max Tokens: ${model.maxTokens.toLocaleString()}`);
        console.log(`  Cost (input): $${model.costPerMTok} per 1M tokens`);
        console.log(`  Cost (output): $${model.costPerOutputMTok} per 1M tokens`);
        console.log('');
      });
    } catch (err) {
      console.error('✗ Failed to list models:', err.message);
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const helper = new N8nHelper();

  if (args.length === 0) {
    console.log(`
Usage: node scripts/load-n8n-config.js [command]

Commands:
  --validate-workflow    Validate n8n workflow file (use this for import)
  --validate-config      Validate configuration reference file
  --export-env           Export environment variables to .env.n8n
  --export-credentials   Show credential template for n8n setup
  --test-rotation        Test local key rotation endpoint
  --list-models          List available Bedrock models

Examples:
  node scripts/load-n8n-config.js --validate-workflow
  node scripts/load-n8n-config.js --test-rotation
  node scripts/load-n8n-config.js --export-env

Files:
  📁 n8n-bedrock-workflow.json       ← IMPORT THIS into n8n
  📁 n8n-credentials-template.json   ← Reference for credentials
  📁 n8n-bedrock-config.json         ← Configuration reference (do not import)
    `);
    process.exit(0);
  }

  const command = args[0];

  switch (command) {
    case '--validate-workflow':
      helper.validateWorkflow();
      break;

    case '--validate-config':
      helper.validateConfig();
      break;

    case '--export-env':
      helper.exportEnv();
      break;

    case '--export-credentials':
      helper.exportCredentials();
      break;

    case '--test-rotation':
      await helper.testRotation();
      break;

    case '--list-models':
      helper.listModels();
      break;

    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

module.exports = N8nHelper;
