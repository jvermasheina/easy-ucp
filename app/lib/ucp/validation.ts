import { z } from 'zod';

// UCP Line Item Schema
export const LineItemSchema = z.object({
  item: z.object({
    id: z.string(),
    title: z.string(),
    price: z.number().positive()
  }),
  id: z.string(),
  quantity: z.number().positive()
});

// UCP Checkout Session Request Schema
export const CheckoutSessionRequestSchema = z.object({
  line_items: z.array(LineItemSchema).min(1)
});

// UCP Buyer Info Schema
export const BuyerInfoSchema = z.object({
  email: z.string().email(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional()
});

// UCP Shipping Address Schema
export const ShippingAddressSchema = z.object({
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  province: z.string(),
  country: z.string(),
  zip: z.string()
});

// UCP Checkout Session Update Schema
export const CheckoutSessionUpdateSchema = z.object({
  line_items: z.array(LineItemSchema).optional(),
  buyer_info: BuyerInfoSchema.optional(),
  shipping_address: ShippingAddressSchema.optional(),
  payment_method: z.any().optional()
});

// UCP Message Schema
export const UCPMessageSchema = z.object({
  type: z.enum(['error', 'warning', 'info']),
  code: z.string(),
  path: z.string(),
  content: z.string(),
  severity: z.enum(['recoverable', 'requires_buyer_input', 'requires_buyer_review']).optional()
});

// Helper function to create UCP error messages
export function createUCPError(
  code: string,
  path: string,
  content: string,
  severity: 'recoverable' | 'requires_buyer_input' | 'requires_buyer_review' = 'recoverable'
) {
  return {
    type: 'error' as const,
    code,
    path,
    content,
    severity
  };
}

// Validate checkout session status
export function validateCheckoutStatus(session: any): {
  status: 'incomplete' | 'ready_for_complete' | 'completed';
  messages: any[];
} {
  const messages = [];

  // Check required fields
  if (!session.buyer_info || !session.buyer_info.email) {
    messages.push(createUCPError(
      'missing',
      '$.buyer.email',
      'Buyer email is required',
      'recoverable'
    ));
  }

  if (!session.shipping_address) {
    messages.push(createUCPError(
      'missing',
      '$.shipping_address',
      'Shipping address is required',
      'requires_buyer_input'
    ));
  }

  if (!session.payment_method) {
    messages.push(createUCPError(
      'missing',
      '$.payment_method',
      'Payment method is required',
      'requires_buyer_input'
    ));
  }

  // Determine status
  let status: 'incomplete' | 'ready_for_complete' | 'completed' = 'incomplete';

  if (session.status === 'completed') {
    status = 'completed';
  } else if (messages.length === 0) {
    status = 'ready_for_complete';
  }

  return { status, messages };
}
