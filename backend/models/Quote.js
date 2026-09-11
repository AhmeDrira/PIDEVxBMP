const mongoose = require('mongoose');
const { QUOTE_UNITS, QUOTE_LINE_TYPES } = require('../utils/quoteTemplates');
const { TRANCHE_TYPES } = require('../utils/paymentSchedule');

/**
 * Ligne de devis detaillee, alimentee par les modeles metier.
 * Liste plate : pas de hierarchie parent/enfant a ce stade.
 */
const quoteLineSchema = new mongoose.Schema({
  designation: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true, enum: QUOTE_UNITS },
  unitPrice: { type: Number, default: 0, min: 0 },
  lineType: { type: String, required: true, enum: QUOTE_LINE_TYPES },
  total: { type: Number, default: 0, min: 0 },
}, { _id: false });

/**
 * Tranche de l'echeancier de paiement.
 * `amount` et `percentage` sont calcules cote serveur, jamais repris du client.
 */
const paymentTrancheSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  type: { type: String, required: true, enum: TRANCHE_TYPES },
  value: { type: Number, default: 0, min: 0 },
  amount: { type: Number, default: 0, min: 0 },
  percentage: { type: Number, default: 0, min: 0 },
}, { _id: false });

const quoteSchema = new mongoose.Schema({
  quoteNumber: {
    type: String,
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Please select a project']
  },
  artisan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: [true, 'Please add a client name'],
    trim: true
  },
  laborHand: {
    type: Number,
    required: [true, 'Please add labor hand amount'],
    min: 0,
    default: 0
  },
  materialsAmount: {
    type: Number,
    required: [true, 'Please add materials amount'],
    min: 0,
    default: 0
  },
  amount: {
    type: Number,
    required:[true, 'Please add an estimated amount'],
    min: 0,
    default: 0
  },
  description: {
    type: String,
    required:[true, 'Please add a description']
  },
  validUntil: {
    type: Date,
    required: [true, 'Please add a validity date']
  },
  paymentTerms: {
    type: String,
    default: ''
  },
  upfrontPercent: {
    type: Number,
    default: 50,
    min: 0,
    max: 100,
  },
  // Optionnel : absent sur un devis libre, ou laborHand/materialsAmount restent
  // saisis a la main. Present quand le devis vient d'un modele metier, et les
  // deux montants sont alors calcules depuis les lignes.
  quoteLines: {
    type: [quoteLineSchema],
    default: undefined,
  },
  // Optionnel : absent => ancien comportement a 2 tranches derivees d'upfrontPercent.
  // Present => echeancier libre a N tranches. upfrontPercent reste renseigne avec
  // le pourcentage de la premiere tranche, pour ne pas casser la facturation.
  paymentSchedule: {
    type: [paymentTrancheSchema],
    default: undefined,
  },
  status: {
    type: String,
    enum:['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true // Gère createdAt automatiquement
});

module.exports = mongoose.model('Quote', quoteSchema);