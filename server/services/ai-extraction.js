import Anthropic from '@anthropic-ai/sdk';

// Create client function to ensure env vars are loaded
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set in environment variables');
  }

  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

/**
 * Extract size chart data from a PDF file using Claude Haiku
 *
 * @param {Buffer} fileBuffer - PDF file buffer
 * @param {string} fileName - Original filename for logging
 * @returns {Promise<Object>} Extracted size chart data
 */
export async function extractSizeChartFromPDF(fileBuffer, fileName = 'unknown') {
  console.log(`📄 Processing: ${fileName}`);
  console.log(`📊 File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`);

  try {
    const base64Data = fileBuffer.toString('base64');
    const startTime = Date.now();

    console.log(`🔄 Calling Claude Haiku API...`);

    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: `Extract the size chart data from this document and return it as structured JSON.

Include:
1. garment_type (e.g., "jacket", "t-shirt", "pants")
2. sizes (array of size labels like ["XS", "S", "M", "L", "XL"])
3. measurements (object with measurement types as keys)
4. unit (either "inches" or "cm")
5. gender (if specified: "male", "female", "unisex", "kids")

Example format:
{
  "garment_type": "rain jacket",
  "gender": "female",
  "unit": "inches",
  "sizes": ["XS", "S", "M", "L", "XL"],
  "measurements": {
    "chest": [34, 36, 38, 40, 42],
    "length": [25, 26, 27, 28, 29],
    "sleeve": [32, 33, 34, 35, 36]
  },
  "confidence": 0.95
}

Return ONLY valid JSON, no additional text.`
          }
        ]
      }]
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Processing time: ${duration}s`);

    // Parse response
    const extractedText = response.content[0].text;

    // Clean response (remove markdown code blocks if present)
    const cleanedText = extractedText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonData = JSON.parse(cleanedText);

    console.log(`✅ Successfully extracted JSON`);
    console.log(`📏 Garment: ${jsonData.garment_type || 'unknown'}`);
    console.log(`📐 Sizes found: ${jsonData.sizes?.length || 0}`);
    console.log(`🎯 Confidence: ${(jsonData.confidence * 100).toFixed(0)}%`);

    return {
      success: true,
      data: jsonData,
      metadata: {
        fileName,
        processingTime: parseFloat(duration),
        confidence: jsonData.confidence || 0,
        extractedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error(`❌ Extraction error: ${error.message}`);

    return {
      success: false,
      error: error.message,
      metadata: {
        fileName,
        extractedAt: new Date().toISOString()
      }
    };
  }
}

/**
 * Validate extracted size chart data
 */
export function validateSizeChartData(data) {
  const errors = [];

  if (!data.garment_type) {
    errors.push('Missing garment_type');
  }

  if (!data.sizes || !Array.isArray(data.sizes) || data.sizes.length === 0) {
    errors.push('Missing or empty sizes array');
  }

  if (!data.measurements || typeof data.measurements !== 'object') {
    errors.push('Missing measurements object');
  }

  if (!data.unit || !['inches', 'cm'].includes(data.unit)) {
    errors.push('Invalid or missing unit (must be "inches" or "cm")');
  }

  // Validate that measurement arrays match size array length
  if (data.sizes && data.measurements) {
    const sizeCount = data.sizes.length;
    for (const [measurementType, values] of Object.entries(data.measurements)) {
      if (!Array.isArray(values)) {
        errors.push(`Measurement "${measurementType}" is not an array`);
      } else if (values.length !== sizeCount) {
        errors.push(`Measurement "${measurementType}" length (${values.length}) doesn't match sizes length (${sizeCount})`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  extractSizeChartFromPDF,
  validateSizeChartData
};
