const Product = require('../models/Product');
const { User } = require('../models/User');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const ProductPayment = require('../models/ProductPayment');
const Notification = require('../models/Notification');
const { logAction } = require('../utils/actionLogger');
const fs = require('fs');

const stripeKey = (process.env.STRIPE_SECRET_KEY || '').trim();
const stripe = (() => {
  try {
    return require('stripe')(stripeKey || ''); // may be empty; we'll validate later
  } catch {
    return null;
  }
})();

const resolveChromeExecutablePath = () => {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
};

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
      success_url: `${appUrl}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
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
      success_url: `${appUrl}/?artisanView=subscription&subscription=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/?artisanView=subscription&subscription=cancel`,
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
      const paidAmount = session.amount_total / 100;
      await SubscriptionPayment.create({
        user: userId,
        planId,
        amount: paidAmount,
        currency: session.currency.toUpperCase(),
        stripeSessionId: sessionId,
        status: 'paid',
        paymentDate: new Date(),
      });

      // Notification for the artisan
      await Notification.create({
        type: 'subscription_activated',
        title: 'Subscription Activated',
        message: `Your ${planId} subscription has been activated! It is valid until ${endDate.toLocaleDateString('en-GB')}.`,
        recipient: userId,
        recipientRole: 'artisan',
        icon: 'CreditCard',
      });

      // Admin log
      await logAction(req, {
        actorOverride: user,
        actionKey: 'artisan.subscription.activated',
        actionLabel: 'Subscription Activated',
        entityType: 'subscription',
        entityId: userId,
        targetName: `${user.firstName} ${user.lastName}`,
        targetRole: 'artisan',
        description: `${user.firstName} ${user.lastName} subscribed to the ${planId} plan for ${paidAmount} ${session.currency.toUpperCase()}.`,
        metadata: { planId, amount: paidAmount, durationDays, endDate },
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

    // Calculate refund based on remaining time
    const startDate = user.subscription.startDate ? new Date(user.subscription.startDate) : new Date();
    const endDate = user.subscription.endDate ? new Date(user.subscription.endDate) : new Date();
    const now = new Date();
    const totalDaysMs = endDate.getTime() - startDate.getTime();
    const totalDays = Math.max(1, Math.round(totalDaysMs / (1000 * 60 * 60 * 24)));
    const remainingDaysMs = Math.max(0, endDate.getTime() - now.getTime());
    const remainingDays = Math.round(remainingDaysMs / (1000 * 60 * 60 * 24));

    // Find the original payment to get the amount
    const lastPayment = await SubscriptionPayment.findOne({
      user: user._id,
      status: 'paid',
    }).sort({ paymentDate: -1 });

    const originalAmount = lastPayment ? Number(lastPayment.amount) : 0;
    const refundAmount = totalDays > 0 && remainingDays > 0
      ? Math.round((originalAmount / totalDays) * remainingDays * 100) / 100
      : 0;

    // Mark as canceled
    user.subscription.status = 'canceled';
    await user.save();

    // Notification for the artisan — with refund info
    await Notification.create({
      type: 'subscription_canceled',
      title: 'Subscription Canceled',
      message: refundAmount > 0
        ? `Your subscription has been canceled. You will receive a refund of ${refundAmount.toFixed(2)} TND for the ${remainingDays} remaining day${remainingDays > 1 ? 's' : ''}.`
        : 'Your subscription has been canceled.',
      recipient: user._id,
      recipientRole: 'artisan',
      icon: 'AlertTriangle',
    });

    // Admin log — cancellation
    await logAction(req, {
      actorOverride: user,
      actionKey: 'artisan.subscription.canceled',
      actionLabel: 'Subscription Canceled',
      entityType: 'subscription',
      entityId: user._id,
      targetName: `${user.firstName} ${user.lastName}`,
      targetRole: 'artisan',
      description: `${user.firstName} ${user.lastName} canceled their ${user.subscription.planId} subscription.`,
      metadata: { planId: user.subscription.planId, remainingDays, refundAmount },
    });

    // Admin log — refund if applicable
    if (refundAmount > 0) {
      await logAction(req, {
        actorOverride: user,
        actionKey: 'artisan.subscription.refund',
        actionLabel: 'Subscription Refund Issued',
        entityType: 'subscription',
        entityId: user._id,
        targetName: `${user.firstName} ${user.lastName}`,
        targetRole: 'artisan',
        description: `Refund of ${refundAmount.toFixed(2)} TND issued to ${user.firstName} ${user.lastName} (${remainingDays} remaining days of ${totalDays} total).`,
        metadata: { originalAmount, refundAmount, remainingDays, totalDays },
      });
    }

    return res.status(200).json({
      message: 'Subscription canceled successfully',
      subscription: user.subscription,
      refundAmount,
      remainingDays,
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    return res.status(500).json({ message: 'Failed to cancel subscription' });
  }
};

const verifyCheckout = async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID is required' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items.data.price.product'],
    });

    if (session.payment_status === 'paid') {
      // Check if already processed (idempotency)
      const existingPayment = await ProductPayment.findOne({ stripeSessionId: sessionId });
      if (existingPayment) {
        return res.status(200).json({ message: 'product purchased successfully' });
      }
      
      const lineItems = session.line_items.data;
      const paymentItems = [];
      
      for (const item of lineItems) {
        // Stripe stores metadata in the product object when using expand
        const productId = item.price.product.metadata.productId;
        const productName = item.price.product.name;
        const quantity = item.quantity;
        const price = item.price.unit_amount / 100;

        if (productId) {
          const product = await Product.findById(productId);
          if (product) {
            product.stock = Math.max(0, product.stock - quantity);
            product.status = product.stock <= 0 ? 'out-of-stock' : (product.stock <= 10 ? 'low-stock' : 'active');
            if (product.stock <= 0) {
              await product.deleteOne();
            } else {
              await product.save();
            }
            
            paymentItems.push({
              productId,
              manufacturerId: product.manufacturer,
              name: productName,
              quantity,
              price,
            });
          }
        }
      }

      // Create ProductPayment record
      const newPayment = await ProductPayment.create({
        user: session.metadata.buyerId || req.user._id,
        items: paymentItems,
        totalAmount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        stripeSessionId: sessionId,
        status: 'paid',
        paymentDate: new Date(),
      });

      // Notify manufacturers
      const manufacturerIds = [...new Set(paymentItems.map(item => item.manufacturerId?.toString()))].filter(Boolean);
      for (const mId of manufacturerIds) {
        try {
          await Notification.create({
            type: 'new_order',
            title: 'New Order Received',
            message: `You have received a new order #${newPayment._id.toString().slice(-6)}. Check your Orders tab for details.`,
            relatedId: newPayment._id,
            relatedModel: 'ProductPayment',
            recipient: mId,
          });
        } catch (err) {
          console.error('Failed to create notification for manufacturer:', mId, err);
        }
      }

      return res.status(200).json({ 
        message: 'product purchased successfully'
      });
    } else {
      return res.status(400).json({ message: 'Payment not successful' });
    }
  } catch (error) {
    console.error('verifyCheckout error:', error);
    return res.status(500).json({ message: 'Failed to verify checkout' });
  }
};

const getProductPayments = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const payments = await ProductPayment.find({ user: req.user._id })
      .populate('items.manufacturerId', 'firstName lastName companyName profilePhoto')
      .sort({ paymentDate: -1 });

    return res.status(200).json(payments);
  } catch (error) {
    console.error('getProductPayments error:', error);
    return res.status(500).json({ message: 'Failed to fetch product payments' });
  }
};

const downloadProductPaymentPdf = async (req, res) => {
  let browser;
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    const payment = await ProductPayment.findById(req.params.id)
      .populate('user', 'firstName lastName email');

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const isOwner = String(payment.user?._id || payment.user || '') === String(req.user._id || '');
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to download this payment receipt' });
    }

    let puppeteer;
    try {
      puppeteer = require('puppeteer-core');
    } catch (dependencyError) {
      return res.status(500).json({
        message: 'PDF dependency missing. Please run npm install in backend to enable Puppeteer PDF.',
      });
    }

    const executablePath = resolveChromeExecutablePath();
    if (!executablePath) {
      return res.status(500).json({
        message: 'No Chrome/Edge executable found for PDF generation. Set CHROME_PATH in backend .env',
      });
    }

    const paymentDate = payment.paymentDate
      ? new Date(payment.paymentDate).toLocaleDateString('en-GB')
      : 'N/A';
    const rowsHtml = (Array.isArray(payment.items) ? payment.items : [])
      .map((item) => `
        <tr>
          <td>${String(item.name || 'Item')}</td>
          <td style="text-align:center">${Number(item.quantity || 0)}</td>
          <td style="text-align:right">${Number(item.price || 0).toFixed(2)}</td>
          <td style="text-align:right">${(Number(item.quantity || 0) * Number(item.price || 0)).toFixed(2)}</td>
        </tr>
      `)
      .join('');

    const currency = String(payment.currency || 'USD').toUpperCase();
    const total = Number(payment.totalAmount || 0);

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
          .page { padding: 32px; }
          .card { background: #ffffff; border-radius: 20px; padding: 28px; border: 1px solid #e2e8f0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 20px; }
          .title { font-size: 44px; font-weight: 800; color: #1d4ed8; margin: 0; letter-spacing: 1px; }
          .number { margin-top: 8px; color: #64748b; font-size: 18px; }
          .brand { text-align: right; }
          .brand h3 { margin: 0; font-size: 28px; color: #0f172a; }
          .brand p { margin: 4px 0 0; color: #64748b; }
          .badge { display: inline-block; margin-top: 10px; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #166534; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 24px 0; }
          .label { font-size: 13px; color: #64748b; margin-bottom: 6px; }
          .value { font-size: 20px; font-weight: 700; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; font-size: 13px; }
          th { background: #f8fafc; text-align: left; }
          .total { margin-top: 16px; text-align: right; font-size: 24px; font-weight: 800; color: #1d4ed8; }
          .footer { margin-top: 20px; color: #64748b; font-size: 12px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="card">
            <div class="header">
              <div>
                <h1 class="title">RECEIPT</h1>
                <div class="number">PAY-${String(payment._id).slice(-8).toUpperCase()}</div>
              </div>
              <div class="brand">
                <h3>BMP Marketplace</h3>
                <p>Digital Construction Platform</p>
                <span class="badge">${String(payment.status || 'paid').toUpperCase()}</span>
              </div>
            </div>

            <div class="grid">
              <div>
                <div class="label">Customer</div>
                <div class="value">${payment.user?.firstName || ''} ${payment.user?.lastName || ''}</div>
              </div>
              <div>
                <div class="label">Payment Date</div>
                <div class="value">${paymentDate}</div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th style="text-align:center">Qty</th>
                  <th style="text-align:right">Unit</th>
                  <th style="text-align:right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>

            <div class="total">${total.toFixed(2)} ${currency}</div>
            <div class="footer">Generated by BMP Marketplace</div>
          </div>
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payment-${String(payment._id).slice(-8)}.pdf"`);
    return res.send(pdf);
  } catch (error) {
    console.error('downloadProductPaymentPdf error:', error);
    return res.status(500).json({ message: 'Failed to generate payment PDF' });
  } finally {
    if (browser) await browser.close();
  }
};

// GET /api/payments/subscription/history/:id/pdf
const downloadSubscriptionReceiptPdf = async (req, res) => {
  let browser;
  try {
    if (!req.user) return res.status(401).json({ message: 'Not authorized' });

    const payment = await SubscriptionPayment.findOne({
      _id: req.params.id,
      user: req.user._id,
    }).populate('user', 'firstName lastName email');

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    let puppeteer;
    try {
      puppeteer = require('puppeteer-core');
    } catch {
      return res.status(500).json({ message: 'PDF dependency missing.' });
    }

    const executablePath = resolveChromeExecutablePath();
    if (!executablePath) {
      return res.status(500).json({ message: 'No Chrome/Edge executable found for PDF generation.' });
    }

    const paymentDate = payment.paymentDate
      ? new Date(payment.paymentDate).toLocaleDateString('en-GB')
      : 'N/A';
    const planLabel = payment.planId
      ? payment.planId.charAt(0).toUpperCase() + payment.planId.slice(1)
      : 'Subscription';
    const amount = Number(payment.amount || 0).toFixed(2);
    const receiptNumber = `REC-${String(payment._id).slice(-8).toUpperCase()}`;
    const userName = payment.user
      ? `${payment.user.firstName || ''} ${payment.user.lastName || ''}`.trim()
      : 'N/A';

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
          .page { padding: 32px; }
          .card { background: #fff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
          .title { font-size: 40px; font-weight: 800; color: #6366f1; letter-spacing: 1px; }
          .subtitle { color: #64748b; font-size: 14px; margin-top: 4px; }
          .badge { display: inline-block; margin-top: 12px; border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 700; background: #dcfce7; color: #166534; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 24px 0; }
          .field label { font-size: 12px; color: #64748b; margin-bottom: 4px; display: block; }
          .field span { font-size: 18px; font-weight: 700; color: #0f172a; }
          .amount-box { background: #f0f0ff; border-radius: 12px; padding: 20px 24px; margin-top: 24px; display: flex; justify-content: space-between; align-items: center; }
          .amount-label { font-size: 14px; color: #64748b; }
          .amount-value { font-size: 32px; font-weight: 800; color: #6366f1; }
          .footer { margin-top: 24px; color: #94a3b8; font-size: 11px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="card">
            <div class="header">
              <div>
                <div class="title">RECEIPT</div>
                <div class="subtitle">${receiptNumber}</div>
                <div class="badge">✓ PAID</div>
              </div>
              <div style="text-align:right">
                <h3 style="font-size:24px;font-weight:800;color:#0f172a;">BMP.tn</h3>
                <p style="color:#64748b;font-size:13px;margin-top:4px;">Subscription Receipt</p>
              </div>
            </div>
            <div class="grid">
              <div class="field"><label>Client</label><span>${userName}</span></div>
              <div class="field"><label>Payment Date</label><span>${paymentDate}</span></div>
              <div class="field"><label>Plan</label><span>${planLabel}</span></div>
              <div class="field"><label>Receipt No.</label><span>${receiptNumber}</span></div>
            </div>
            <div class="amount-box">
              <span class="amount-label">Total Paid</span>
              <span class="amount-value">${amount} DT</span>
            </div>
            <div class="footer">Thank you for your subscription. This is an automatically generated receipt.</div>
          </div>
        </div>
      </body>
      </html>
    `;

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    browser = null;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt-${receiptNumber}.pdf"`);
    return res.send(pdfBuffer);
  } catch (err) {
    console.error('downloadSubscriptionReceiptPdf error:', err);
    if (browser) await browser.close();
    return res.status(500).json({ message: 'Failed to generate PDF receipt' });
  }
};

module.exports = { createCheckoutSession, createSubscriptionSession, verifySubscription, getSubscriptionHistory, cancelSubscription, verifyCheckout, getProductPayments, downloadProductPaymentPdf, downloadSubscriptionReceiptPdf };
