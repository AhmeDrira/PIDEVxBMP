const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Please select a project']
  },
  quote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote',
    default: null
  },
  artisan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: [true, 'Please add a client name']
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  description: {
    type: String,
    required: [true, 'Please add a description']
  },
  issueDate: {
    type: Date,
    required: [true, 'Please add an issue date']
  },
  dueDate: {
    type: Date,
    required:[true, 'Please add a due date']
  },
  status: {
    type: String,
    enum:['pending', 'paid', 'overdue'],
    default: 'pending'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  paymentProgress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  paymentPlan: {
    /**
     * Echeancier a N tranches — SOURCE DE VERITE.
     *
     * Les champs `firstTranche*` / `secondTranche*` qui suivent sont conserves
     * en MIROIR, alimentes par `mirrorLegacyFields`, pour les lecteurs pas
     * encore repris (PDF de facture, ecran des factures). Ne jamais s'en
     * servir comme source : sur un echeancier a trois tranches, `secondTranche`
     * agrege tout ce qui suit la premiere et ne designe aucune tranche reelle.
     *
     * Vide sur les factures anterieures : `normalizePaymentPlan` le
     * reconstruit a la lecture depuis les anciens champs.
     */
    tranches: [{
      label: { type: String, default: '' },
      percent: { type: Number, default: 0, min: 0, max: 100 },
      amount: { type: Number, default: 0, min: 0 },
      paid: { type: Boolean, default: false },
      paidAt: { type: Date, default: null },
      dueDate: { type: Date, default: null },
    }],
    /**
     * Les champs `firstTranche*` / `secondTranche*` ont ete retires : plus
     * aucun lecteur n'en depend. Les documents deja en base les portent encore,
     * et `buildTranchesFromLegacy` sait les relire pour reconstituer le
     * tableau — c'est justement a ca qu'il sert.
     */
  },
  paymentSessions: [{
    sessionId: { type: String, required: true },
    // `phase` reste accepte pour les sessions deja enregistrees ; les
    // nouvelles portent le rang de la tranche, seul repere fiable au-dela
    // de deux echeances.
    phase: { type: String, enum: ['upfront', 'completion'], default: null },
    trancheIndex: { type: Number, default: null, min: 0 },
    amount: { type: Number, required: true },
    paidAt: { type: Date, default: Date.now },
  }],
  delivery: {
    status: {
      type: String,
      enum: ['none', 'scheduled', 'in_transit', 'delivered'],
      default: 'none',
    },
    etaDate: { type: Date, default: null },
    timeline: [{
      title: { type: String },
      date: { type: Date },
      status: { type: String, enum: ['done', 'upcoming'], default: 'upcoming' },
    }],
  },
}, {
  timestamps: true
});

module.exports = mongoose.model('Invoice', invoiceSchema);