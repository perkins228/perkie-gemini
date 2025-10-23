const { Storage } = require('@google-cloud/storage');
const path = require('path');

const bucketName = process.env.GC_BUCKET;

if (!bucketName) {
  console.warn('⚠️ GC_BUCKET environment variable not set. Using local storage for development.');
  // Create a mock bucket for local development
  const mockBucket = {
    file: (filename) => ({
      save: async (buffer) => {
        console.log(`[MOCK] Would save file ${filename} to bucket ${bucketName}`);
        return Promise.resolve();
      }
    })
  };
  module.exports = { bucket: mockBucket };
  return;
}

try {
  const storage = new Storage({
    keyFilename: path.join(__dirname, '..', 'perkieprints-sa-key.json')
  });
  const bucket = storage.bucket(bucketName);
  module.exports = { bucket };
} catch (error) {
  console.error('❌ Error initializing Google Cloud Storage:', error.message);
  throw error;
}
