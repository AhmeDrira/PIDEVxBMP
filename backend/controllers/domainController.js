const Review = require('../models/Review');
const ArtisanDomain = require('../models/ArtisanDomain');
const DomainService = require('../services/DomainService');
const { checkSlugEditable } = require('../utils/slugRules');

// Mise en forme commune des réponses « mon mini site ».
const serializeDomain = (domain, requestHost) => {
  const lock = checkSlugEditable(domain);
  return {
    slug: domain.slug,
    url: DomainService.buildMiniSiteUrl(domain.slug, requestHost),
    lockedAt: domain.lockedAt,
    daysRemaining: lock.daysRemaining,
    editable: lock.editable,
  };
};

// Récupère le mini site de l'artisan connecté, en le créant au passage s'il n'existe
// pas encore (artisan inscrit avant la fonctionnalité et non rattrapé par le script).
const loadOwnDomain = async (user) => {
  const existing = await ArtisanDomain.findOne({ artisanId: user._id });
  if (existing) return existing;
  return DomainService.ensureDomainForArtisan(user);
};


// @desc    Vérifier en temps réel qu'un slug de mini site est attribuable
// @route   GET /api/check-slug?slug=...
// @access  Public
exports.checkSlug = async (req, res) => {
  try {
    const result = await DomainService.checkSlugAvailable(req.query.slug);

    // Toujours 200 : une saisie invalide n'est pas une erreur HTTP. L'appel est
    // déclenché à chaque frappe (debounce 500 ms côté client), un 4xx polluerait
    // la console du navigateur à chaque caractère intermédiaire.
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Profil public d'un artisan, par slug de mini site
// @route   GET /api/public/artisan/:slug
// @access  Public
exports.getPublicArtisan = async (req, res) => {
  try {
    const resolved = await DomainService.resolveBySlug(req.params.slug);
    if (!resolved) {
      return res.status(404).json({ message: 'Artisan not found' });
    }

    const { artisan, domain } = resolved;
    const reviews = await Review.find({ artisan: artisan._id })
      .populate('expert', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    // buildPublicProfile construit une liste blanche : un champ ajoute demain sur
    // le modele User ne peut pas fuiter par accident.
    return res.status(200).json(
      DomainService.buildPublicProfile(artisan, domain, { reviews, requestHost: req.headers.host })
    );
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Mini site de l'artisan connecté
// @route   GET /api/artisan-domain/me
// @access  Private (artisan)
exports.getMyDomain = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'artisan') {
      return res.status(403).json({ message: 'Artisan account required' });
    }

    const domain = await loadOwnDomain(req.user);
    if (!domain) {
      return res.status(404).json({ message: 'Mini site not found' });
    }

    return res.status(200).json(serializeDomain(domain, req.headers.host));
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Changer le slug de son mini site (fenêtre de 30 jours)
// @route   PUT /api/artisan-domain/me
// @access  Private (artisan)
exports.updateMyDomain = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'artisan') {
      return res.status(403).json({ message: 'Artisan account required' });
    }

    const domain = await loadOwnDomain(req.user);
    if (!domain) {
      return res.status(404).json({ message: 'Mini site not found' });
    }

    const lock = checkSlugEditable(domain);
    if (!lock.editable) {
      return res.status(403).json({ message: lock.message, reason: lock.error });
    }

    const check = await DomainService.checkSlugAvailable(req.body?.slug, {
      excludeArtisanId: req.user._id,
    });

    if (!check.available) {
      // Format invalide → 400 ; slug réservé ou déjà pris → 409.
      const isConflict =
        check.reason === DomainService.RESERVED_REASON ||
        check.reason === DomainService.TAKEN_REASON;

      return res.status(isConflict ? 409 : 400).json({
        message: check.message,
        reason: check.reason,
        ...(check.suggestion ? { suggestion: check.suggestion } : {}),
      });
    }

    // Rien à faire si le slug ne change pas — évite une écriture inutile.
    if (check.slug !== domain.slug) {
      domain.slug = check.slug;
      await domain.save();
    }

    return res.status(200).json(serializeDomain(domain, req.headers.host));
  } catch (error) {
    // Course avec une autre requête : l'index unique a tranché.
    if (error && error.code === 11000) {
      return res.status(409).json({
        message: 'This slug is already taken',
        reason: DomainService.TAKEN_REASON,
      });
    }
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
