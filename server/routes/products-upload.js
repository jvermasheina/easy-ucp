import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import supabase from '../config/supabase.js';

const router = express.Router();

// Multer config: accept CSV files up to 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  }
});

// Required CSV columns
const REQUIRED_COLUMNS = ['name', 'price', 'url'];
const OPTIONAL_COLUMNS = ['description', 'currency', 'image_url', 'sku', 'category', 'brand'];

/**
 * Authenticate merchant via API key
 */
async function authenticateMerchant(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  const { data: merchant, error } = await supabase
    .from('easy_ucp_merchants')
    .select('*')
    .eq('api_key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !merchant) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.merchant = merchant;
  next();
}

/**
 * POST /api/products/upload
 * Upload CSV file with product catalog
 */
router.post('/api/products/upload', authenticateMerchant, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file provided. Send as multipart/form-data with field name "file"' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    let records;

    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (parseError) {
      return res.status(400).json({ error: `CSV parse error: ${parseError.message}` });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Validate required columns
    const columns = Object.keys(records[0]);
    const missingColumns = REQUIRED_COLUMNS.filter(col => !columns.includes(col));
    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: `Missing required columns: ${missingColumns.join(', ')}`,
        required: REQUIRED_COLUMNS,
        optional: OPTIONAL_COLUMNS,
        found: columns
      });
    }

    // Validate and transform records
    const errors = [];
    const products = records.map((row, index) => {
      const rowNum = index + 2; // +2 for header row + 1-based

      if (!row.name || !row.name.trim()) {
        errors.push(`Row ${rowNum}: missing name`);
      }
      if (!row.price || isNaN(parseFloat(row.price))) {
        errors.push(`Row ${rowNum}: invalid price "${row.price}"`);
      }
      if (!row.url || !row.url.trim()) {
        errors.push(`Row ${rowNum}: missing url`);
      }

      return {
        merchant_id: req.merchant.id,
        name: (row.name || '').trim(),
        description: (row.description || '').trim() || null,
        price: parseFloat(row.price) || 0,
        currency: (row.currency || 'EUR').trim().toUpperCase(),
        url: (row.url || '').trim(),
        image_url: (row.image_url || '').trim() || null,
        sku: (row.sku || '').trim() || null,
        category: (row.category || '').trim() || null,
        brand: (row.brand || '').trim() || null,
        active: true
      };
    });

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation errors in CSV data',
        errors: errors.slice(0, 20), // Show first 20 errors
        total_errors: errors.length
      });
    }

    // Check replace mode: if ?replace=true, delete existing products first
    if (req.query.replace === 'true') {
      await supabase
        .from('easy_ucp_products')
        .delete()
        .eq('merchant_id', req.merchant.id);
    }

    // Insert products in batches of 100
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('easy_ucp_products')
        .insert(batch);

      if (insertError) {
        return res.status(500).json({
          error: 'Failed to insert products',
          detail: insertError.message,
          inserted_so_far: inserted
        });
      }
      inserted += batch.length;
    }

    // Update merchant product count
    const { count } = await supabase
      .from('easy_ucp_products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', req.merchant.id)
      .eq('active', true);

    await supabase
      .from('easy_ucp_merchants')
      .update({ product_count: count, updated_at: new Date().toISOString() })
      .eq('id', req.merchant.id);

    res.status(201).json({
      success: true,
      products_uploaded: inserted,
      total_active_products: count,
      mode: req.query.replace === 'true' ? 'replace' : 'append',
      ucp_endpoint: `/.well-known/ucp/${req.merchant.slug}`
    });

  } catch (error) {
    console.error('CSV upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/products/json
 * Upload products as JSON array
 */
router.post('/api/products/json', authenticateMerchant, async (req, res) => {
  try {
    const { products: inputProducts } = req.body;

    if (!Array.isArray(inputProducts) || inputProducts.length === 0) {
      return res.status(400).json({
        error: 'Request body must contain "products" array',
        example: {
          products: [
            { name: 'Product Name', price: 29.99, url: 'https://store.com/product', description: 'Optional', currency: 'EUR' }
          ]
        }
      });
    }

    // Validate
    const errors = [];
    const products = inputProducts.map((item, index) => {
      if (!item.name) errors.push(`Product ${index + 1}: missing name`);
      if (item.price === undefined || isNaN(parseFloat(item.price))) errors.push(`Product ${index + 1}: invalid price`);
      if (!item.url) errors.push(`Product ${index + 1}: missing url`);

      return {
        merchant_id: req.merchant.id,
        name: (item.name || '').trim(),
        description: (item.description || '').trim() || null,
        price: parseFloat(item.price) || 0,
        currency: (item.currency || 'EUR').trim().toUpperCase(),
        url: (item.url || '').trim(),
        image_url: (item.image_url || '').trim() || null,
        sku: (item.sku || '').trim() || null,
        category: (item.category || '').trim() || null,
        brand: (item.brand || '').trim() || null,
        active: true
      };
    });

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation errors',
        errors: errors.slice(0, 20),
        total_errors: errors.length
      });
    }

    // Check replace mode
    if (req.query.replace === 'true') {
      await supabase
        .from('easy_ucp_products')
        .delete()
        .eq('merchant_id', req.merchant.id);
    }

    // Insert in batches
    const batchSize = 100;
    let inserted = 0;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('easy_ucp_products')
        .insert(batch);

      if (insertError) {
        return res.status(500).json({
          error: 'Failed to insert products',
          detail: insertError.message,
          inserted_so_far: inserted
        });
      }
      inserted += batch.length;
    }

    // Update merchant product count
    const { count } = await supabase
      .from('easy_ucp_products')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', req.merchant.id)
      .eq('active', true);

    await supabase
      .from('easy_ucp_merchants')
      .update({ product_count: count, updated_at: new Date().toISOString() })
      .eq('id', req.merchant.id);

    res.status(201).json({
      success: true,
      products_uploaded: inserted,
      total_active_products: count,
      mode: req.query.replace === 'true' ? 'replace' : 'append',
      ucp_endpoint: `/.well-known/ucp/${req.merchant.slug}`
    });

  } catch (error) {
    console.error('JSON upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/products/mine
 * List merchant's own products
 */
router.get('/api/products/mine', authenticateMerchant, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;

    const { data: products, error, count } = await supabase
      .from('easy_ucp_products')
      .select('*', { count: 'exact' })
      .eq('merchant_id', req.merchant.id)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch products' });
    }

    res.json({
      products,
      pagination: {
        page,
        limit,
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('List products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/products/mine
 * Delete all merchant's products
 */
router.delete('/api/products/mine', authenticateMerchant, async (req, res) => {
  try {
    const { error } = await supabase
      .from('easy_ucp_products')
      .delete()
      .eq('merchant_id', req.merchant.id);

    if (error) {
      return res.status(500).json({ error: 'Failed to delete products' });
    }

    await supabase
      .from('easy_ucp_merchants')
      .update({ product_count: 0, updated_at: new Date().toISOString() })
      .eq('id', req.merchant.id);

    res.json({ success: true, message: 'All products deleted' });
  } catch (error) {
    console.error('Delete products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
