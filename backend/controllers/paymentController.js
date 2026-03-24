const Product = require('../models/Product');
const { User } = require('../models/User');
const SubscriptionPayment = require('../models/SubscriptionPayment');

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

const createSubscriptionSession = async (req, res) => {
  try {
    if (!req.user || !['expert', 'artisan'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only expert or artisan accounts can subscribe' });
    }
    if (!stripe || !stripeKey) {
      return res.status(500).json({ message: 'Stripe secret key is missing on the server' });
    }

    const { planId, price, name, duration } = req.body;
    if (!planId || !price) {
      return res.status(400).json({ message: 'Plan ID and price are required' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    
    // In a real app, we would use a Stripe Price ID for recurring payments.
    // For this simple implementation, we use a one-time payment session.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(price * 100),
            product_data: {
              name: `Subscription: ${name}`,
              description: `Plan: ${duration}`,
            },
          },
        },
      ],
      success_url: `${appUrl}/?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?subscription=cancel`,
      metadata: {
        userId: String(req.user._id),
        planId,
        type: 'subscription',
      },
    });

    // We store the session ID to verify it later when the user returns
    await User.findByIdAndUpdate(req.user._id, {
      'subscription.stripeSessionId': session.id,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('createSubscriptionSession error:', error);
    return res.status(500).json({ message: 'Failed to create subscription session' });
  }
};

const verifySubscription = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === 'paid') {
      const userId = session.metadata.userId;
      const planId = session.metadata.planId;

      let durationDays = 30;
      if (planId === '3months') durationDays = 90;
      if (planId === 'yearly') durationDays = 365;

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + durationDays);

      const user = await User.findByIdAndUpdate(userId, {
        subscription: {
          planId,
          status: 'active',
          startDate: new Date(),
          endDate,
          stripeSessionId: sessionId,
        },
      }, { new: true });

      // Create a payment record
      await SubscriptionPayment.create({
        user: userId,
        planId,
        amount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        stripeSessionId: sessionId,
        status: 'paid',
        paymentDate: new Date(),
      });

      return res.status(200).json({ 
        message: 'Subscription activated successfully',
        subscription: user.subscription 
      });
    }

    return res.status(400).json({ message: 'Payment not completed' });
  } catch (error) {
    console.error('verifySubscription error:', error);
    return res.status(500).json({ message: 'Failed to verify subscription' });
  }
};

const getSubscriptionHistory = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const history = await SubscriptionPayment.find({ user: req.user._id })
      .sort({ paymentDate: -1 });

    return res.status(200).json(history);
  } catch (error) {
    console.error('getSubscriptionHistory error:', error);
    return res.status(500).json({ message: 'Failed to fetch subscription history' });
  }
};

const cancelSubscription = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const user = await User.findById(req.user._id);
    if (!user || !user.subscription || user.subscription.status !== 'active') {
      return res.status(400).json({ message: 'No active subscription found' });
    }

    // Mark as canceled
    user.subscription.status = 'canceled';
    // We could also set the endDate to now if we want immediate termination, 
    // but usually, subscriptions last until the end of the period.
    // For this simple case, we'll mark it as canceled (inactive for UI).
    await user.save();

    return res.status(200).json({ 
      message: 'Subscription canceled successfully',
      subscription: user.subscription 
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    return res.status(500).json({ message: 'Failed to cancel subscription' });
  }
};

module.exports = { createCheckoutSession, createSubscriptionSession, verifySubscription, getSubscriptionHistory, cancelSubscription };
