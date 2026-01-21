import express from 'express';
import multer from 'multer';
import { createRequire } from 'module';
import { extractSizeChartFromPDF, validateSizeChartData } from '../services/ai-extraction.js';
import supabase from '../config/supabase.js';
import { optionalVerifyRequest } from '../middleware/verify-request.js';
import { aiExtractionLimiter, generalApiLimiter } from '../middleware/rate-limit.js';
import logger from '../utils/logger.js';
import { validateSizeChartFull } from '../validators/size-chart.js';

// Lazy-load pdf-parse to avoid startup crashes if native deps are missing
let pdfParse = null;
function getPdfParse() {
  if (!pdfParse) {
    const require = createRequire(import.meta.url);
    pdfParse = require('pdf-parse');
  }
  return pdfParse;
}

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only accept PDFs for now
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

/**
 * POST /api/extract
 * Extract size chart data from uploaded PDF
 * Rate limited to prevent AI API abuse and cost overruns
 */
router.post('/extract', aiExtractionLimiter, optionalVerifyRequest, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    logger.info('File upload received', {
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Validate PDF content before AI extraction
    try {
      // pdf-parse v1.x API (v2 requires browser APIs not available in Node.js)
      const parser = getPdfParse();
      const pdfData = await parser(req.file.buffer);

      // Basic validation
      if (!pdfData.text || pdfData.text.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'PDF appears to be empty or corrupted'
        });
      }

      // Check for suspicious content
      if (pdfData.text.includes('<script>') || pdfData.text.includes('javascript:')) {
        logger.warn('PDF contains suspicious content', {
          filename: req.file.originalname
        });
        return res.status(400).json({
          success: false,
          error: 'PDF contains suspicious content'
        });
      }

      logger.info('PDF validation passed', {
        pages: pdfData.numpages,
        textLength: pdfData.text.length,
        filename: req.file.originalname
      });

    } catch (pdfError) {
      logger.error('PDF validation failed', {
        error: pdfError.message,
        filename: req.file.originalname
      });
      return res.status(400).json({
        success: false,
        error: 'Invalid PDF file',
        details: pdfError.message
      });
    }

    // Extract data using AI
    const result = await extractSizeChartFromPDF(req.file.buffer, req.file.originalname);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Extraction failed'
      });
    }

    // Validate extracted data
    const validation = validateSizeChartData(result.data);
    if (!validation.valid) {
      console.warn('⚠️  Validation warnings:', validation.errors);
    }

    // Return extracted data
    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
      validation: validation
    });

  } catch (error) {
    console.error('Error in /api/extract:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/size-charts
 * Save size chart to database
 */
router.post('/size-charts', optionalVerifyRequest, async (req, res) => {
  try {
    const { name, data } = req.body;
    // Get shop from authenticated session or fallback to query parameter
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    if (!name || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, data'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Validate size chart data structure
    const validation = validateSizeChartFull({ ...data, name });

    if (!validation.success) {
      logger.warn('Size chart validation failed', {
        shop,
        errors: validation.errors
      });
      return res.status(400).json({
        success: false,
        error: validation.error,
        details: validation.errors
      });
    }

    logger.info('Size chart validation passed', {
      shop,
      name,
      sizeCount: validation.value.sizes?.length,
      measurementCount: Object.keys(validation.value.measurements || {}).length
    });

    // Use validated data
    const validatedData = validation.value;

    // Insert size chart into database (using validated data)
    const { data: sizeChart, error } = await supabase
      .from('size_charts')
      .insert({
        shop_domain: shop,
        name: validatedData.name,
        garment_type: validatedData.garment_type || null,
        gender: validatedData.gender || null,
        unit: validatedData.unit || 'cm',
        sizes: validatedData.sizes,
        measurements: validatedData.measurements,
        confidence: validatedData.confidence || null,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to save size chart',
        details: error.message
      });
    }

    console.log('✅ Size chart saved:', sizeChart.id);

    res.json({
      success: true,
      data: sizeChart
    });

  } catch (error) {
    console.error('Error in /api/size-charts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/size-charts
 * Get all size charts for a shop
 */
router.get('/size-charts', optionalVerifyRequest, async (req, res) => {
  try {
    // Get shop from authenticated session or fallback to query parameter
    const shop = req.shop || req.query.shop;

    if (!shop) {
      return res.status(400).json({
        success: false,
        error: 'Missing shop parameter'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { data: sizeCharts, error } = await supabase
      .from('size_charts')
      .select('*')
      .eq('shop_domain', shop)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch size charts'
      });
    }

    res.json({
      success: true,
      data: sizeCharts || []
    });

  } catch (error) {
    console.error('Error in GET /api/size-charts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PUT /api/size-charts/:id
 * Update a size chart
 */
router.put('/size-charts/:id', optionalVerifyRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, garment_type, gender, unit, sizes, measurements } = req.body;

    if (!name || !garment_type || !unit || !sizes || !measurements) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    // Update size chart in database
    const { data: sizeChart, error } = await supabase
      .from('size_charts')
      .update({
        name: name,
        garment_type: garment_type,
        gender: gender,
        unit: unit,
        sizes: sizes,
        measurements: measurements,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to update size chart',
        details: error.message
      });
    }

    console.log('✅ Size chart updated:', sizeChart.id);

    res.json({
      success: true,
      data: sizeChart
    });

  } catch (error) {
    console.error('Error in PUT /api/size-charts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/size-charts/:id
 * Delete (soft delete) a size chart
 */
router.delete('/size-charts/:id', optionalVerifyRequest, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({
        success: false,
        error: 'Database not configured'
      });
    }

    const { error } = await supabase
      .from('size_charts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete size chart'
      });
    }

    res.json({
      success: true,
      message: 'Size chart deleted'
    });

  } catch (error) {
    console.error('Error in DELETE /api/size-charts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
