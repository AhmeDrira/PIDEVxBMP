const mongoose = require('mongoose');

// Le slug est modifiable pendant cette fenêtre, puis verrouillé définitivement.
const SLUG_LOCK_DAYS = 30;
const SLUG_LOCK_MS = SLUG_LOCK_DAYS * 24 * 60 * 60 * 1000;

const artisanDomainSchema = new mongoose.Schema({
  // `Artisan` est un discriminator de `User` (models/User.js), la référence pointe donc sur 'User'.
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  // Domaine personnalisé (évolution future) : unique seulement parmi les documents qui en ont un.
  customDomain: {
    type: String,
    lowercase: true,
    trim: true,
    index: {
      unique: true,
      partialFilterExpression: { customDomain: { $type: 'string' } },
    },
  },
  verified: {
    type: Boolean,
    default: false,
  },
  tlsStatus: {
    type: String,
  },
  // Rempli automatiquement à la création : date de fin de la fenêtre de modification du slug.
  lockedAt: {
    type: Date,
    default: () => new Date(Date.now() + SLUG_LOCK_MS),
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Le slug est verrouillé une fois `lockedAt` dépassé.
artisanDomainSchema.methods.isSlugLocked = function (now = new Date()) {
  if (!this.lockedAt) return false;
  return now >= this.lockedAt;
};

// Nombre de jours restants avant verrouillage (0 si déjà verrouillé) — pour le message d'onboarding.
artisanDomainSchema.methods.daysUntilLock = function (now = new Date()) {
  if (!this.lockedAt) return null;
  const remaining = this.lockedAt.getTime() - now.getTime();
  return remaining <= 0 ? 0 : Math.ceil(remaining / (24 * 60 * 60 * 1000));
};

const ArtisanDomain = mongoose.model('ArtisanDomain', artisanDomainSchema);

module.exports = ArtisanDomain;
module.exports.SLUG_LOCK_DAYS = SLUG_LOCK_DAYS;
