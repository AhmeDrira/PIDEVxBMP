const Product = require('../models/Product');

const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const stripe = (() => {
  try {
    return require('stripe')(stripeKey || ''); // may be empty; we'll validate later
  } catch {
    return null;
  }
})();

// POST /api/payments/checkout
// Creates a Stripe Checkout Session and returns { url }
const createCheckoutSession = async (req, res) => {
  try {
    if (!req.user || !['expert', 'artisan'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only expert or artisan accounts can checkout materials' });
    }
    if (!stripe || !stripeKey) {
      return res.status(500).json({ message: 'Stripe secret key is missing on the server' });
    }
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
      return res.status(400).json({ message: 'Cart is empty' });
    }
    const normalizedItems = items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity),
      }))
      .filter((item) => item.productId && Number.isFinite(item.quantity) && item.quantity > 0);

    if (!normalizedItems.length) {
      return res.status(400).json({ message: 'Invalid cart items' });
    }

    const productIds = normalizedItems.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } });
    const productsMap = new Map(products.map((p) => [String(p._id), p]));

    const line_items = [];
    for (const item of normalizedItems) {
      const p = productsMap.get(String(item.productId));
      if (!p) {
        return res.status(404).json({ message: 'One or more products no longer exist' });
      }
      // Stripe test mode: use USD cents for simplicity
      const unitAmountRaw = Number(p.price);
      const unitAmount = Math.round(unitAmountRaw * 100);
      if (!Number.isFinite(unitAmount) || unitAmount < 50) {
        return res.status(400).json({ message: `Invalid product price for "${p.name}"` });
      }
      line_items.push({
        quantity: item.quantity,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: p.name,
            metadata: {
              productId: String(p._id),
              manufacturerId: String(p.manufacturer || ''),
            },
          },
        },
      });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${appUrl}/?checkout=success`,
      cancel_url: `${appUrl}/?checkout=cancel`,
      metadata: {
        buyerId: String(req.user._id || ''),
        role: req.user.role || '',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('createCheckoutSession error:', error);
    return res.status(500).json({ message: 'Failed to create checkout session' });
  }
};

module.exports = { createCheckoutSession };
