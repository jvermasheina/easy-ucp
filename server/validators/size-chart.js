/**
 * Size Chart Data Validation
 * Uses Joi for JSONB schema validation
 */
import Joi from 'joi';

/**
 * Size Chart Validation Schema
 * Validates the structure and content of size chart data
 */
export const sizeChartSchema = Joi.object({
  // Required fields
  name: Joi.string()
    .min(1)
    .max(255)
    .required()
    .messages({
      'string.empty': 'Size chart name is required',
      'string.max': 'Size chart name cannot exceed 255 characters',
      'any.required': 'Size chart name is required'
    }),

  sizes: Joi.array()
    .items(Joi.string().min(1).max(10))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one size is required',
      'array.base': 'Sizes must be an array',
      'any.required': 'Sizes are required'
    }),

  measurements: Joi.object()
    .pattern(
      Joi.string(),
      Joi.array().items(Joi.number()).min(1)
    )
    .min(1)
    .required()
    .messages({
      'object.min': 'At least one measurement type is required',
      'object.base': 'Measurements must be an object',
      'any.required': 'Measurements are required'
    }),

  // Optional fields
  garment_type: Joi.string()
    .max(100)
    .allow(null, '')
    .optional(),

  gender: Joi.string()
    .valid('male', 'female', 'unisex', 'kids', null, '')
    .optional(),

  unit: Joi.string()
    .valid('inches', 'cm', 'in')
    .optional()
    .default('cm')
    .messages({
      'any.only': 'Unit must be either "inches", "cm", or "in"'
    }),

  confidence: Joi.number()
    .min(0)
    .max(1)
    .optional()
    .messages({
      'number.min': 'Confidence must be between 0 and 1',
      'number.max': 'Confidence must be between 0 and 1'
    }),

  // Allow other fields from AI extraction
  shop_domain: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  id: Joi.string().optional()
}).messages({
  'object.base': 'Size chart data must be a valid object'
});

/**
 * Validate size chart data
 * @param {Object} data - Size chart data to validate
 * @returns {Object} - { error, value }
 */
export function validateSizeChart(data) {
  return sizeChartSchema.validate(data, {
    abortEarly: false, // Return all errors, not just the first one
    stripUnknown: true // Remove unknown fields
  });
}

/**
 * Custom validation: Check if measurement arrays match sizes array length
 * @param {Object} data - Size chart data
 * @returns {Array} - Array of validation errors (empty if valid)
 */
export function validateMeasurementConsistency(data) {
  const errors = [];

  if (!data.sizes || !data.measurements) {
    return errors; // Basic validation will catch these
  }

  const sizeCount = data.sizes.length;

  // Check each measurement type
  for (const [measurementType, values] of Object.entries(data.measurements)) {
    if (!Array.isArray(values)) {
      errors.push(`Measurement "${measurementType}" must be an array`);
      continue;
    }

    if (values.length !== sizeCount) {
      errors.push(
        `Measurement "${measurementType}" has ${values.length} values but ${sizeCount} sizes are defined. They must match.`
      );
    }

    // Check all values are numbers
    const nonNumeric = values.filter(v => typeof v !== 'number');
    if (nonNumeric.length > 0) {
      errors.push(
        `Measurement "${measurementType}" contains non-numeric values: ${JSON.stringify(nonNumeric)}`
      );
    }
  }

  return errors;
}

/**
 * Full validation with custom checks
 * @param {Object} data - Size chart data to validate
 * @returns {Object} - { success, error, value, errors }
 */
export function validateSizeChartFull(data) {
  // Schema validation
  const { error, value } = validateSizeChart(data);

  if (error) {
    return {
      success: false,
      error: 'Size chart validation failed',
      errors: error.details.map(d => d.message),
      value: null
    };
  }

  // Custom consistency checks
  const consistencyErrors = validateMeasurementConsistency(value);

  if (consistencyErrors.length > 0) {
    return {
      success: false,
      error: 'Measurement consistency check failed',
      errors: consistencyErrors,
      value: null
    };
  }

  return {
    success: true,
    error: null,
    errors: [],
    value
  };
}

export default {
  sizeChartSchema,
  validateSizeChart,
  validateMeasurementConsistency,
  validateSizeChartFull
};
