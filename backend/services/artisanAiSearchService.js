const EMBEDDING_MODEL = process.env.ARTISAN_SEARCH_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;
const DEFAULT_LIMIT = 24;
const MAX_CACHED_EMBEDDINGS = 800;

const SPECIALIZATION_SYNONYMS = {
  Plumbing: ['plumbing', 'plumber', 'plomberie', 'plombier', 'sanitary', 'sanitaire', 'sink', 'lavabo', 'faucet', 'robinet', 'pipe', 'pipes', 'drain', 'canalisation'],
  'Electrical Installation': ['electrical', 'electricity', 'electrician', 'electric', 'wiring', 'cabling', 'cable', 'installation electrique', 'installation electriques', 'electrique', 'electriques', 'électrique', 'électricité', 'electricien', 'électricien', 'tableau electrique'],
  Carpentry: ['carpentry', 'carpenter', 'woodwork', 'wood', 'menuiserie', 'menuisier', 'bois', 'door', 'porte', 'cabinet'],
  Masonry: ['masonry', 'mason', 'brick', 'stone', 'wall', 'walls', 'mur', 'murs', 'maconnerie', 'maçonnerie', 'macon', 'maçon', 'brique', 'pierre'],
  'Concrete Work': ['concrete', 'beton', 'béton', 'slab', 'dalle', 'betonnage'],
  'Foundation Construction': ['foundation', 'foundations', 'fondation', 'fondations', 'footing', 'semelle'],
  Painting: ['painting', 'paint', 'peinture', 'peintre', 'coating'],
  Tiling: ['tiling', 'tile', 'tiles', 'carrelage', 'carreleur'],
  Plastering: ['plaster', 'plastering', 'enduit', 'platre', 'plâtre', 'staff'],
  Roofing: ['roof', 'roofing', 'toiture', 'couvreur'],
  Waterproofing: ['waterproofing', 'waterproof', 'etancheite', 'étanchéité', 'leakproof'],
  HVAC: ['hvac', 'heating', 'cooling', 'ventilation', 'climatisation', 'chauffage', 'air conditioning'],
  'Metal Work': ['metal', 'metalwork', 'metallique', 'métallique', 'metallerie', 'métallerie', 'soudure', 'welding'],
  'Aluminum Work': ['aluminum', 'aluminium', 'fenetre aluminium', 'menuiserie aluminium'],
};

const KNOWN_LOCATIONS = [
  'tunis', 'ariana', 'ben arous', 'manouba', 'nabeul', 'zaghouan', 'bizerte',
  'beja', 'béja', 'jendouba', 'kef', 'siliana', 'kairouan', 'kasserine', 'sidi bouzid',
  'sousse', 'monastir', 'mahdia', 'sfax', 'gafsa', 'tozeur', 'kebili', 'gabes', 'gabès',
  'medenine', 'médenine', 'tataouine',
];

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'artisan', 'artisans', 'avec', 'best', 'ce', 'cet', 'cette', 'de',
  'des', 'du', 'for', 'give', 'has', 'i', 'il', 'je', 'la', 'le', 'les', 'me', 'moi',
  'mon', 'my', 'of', 'ou', 'par', 'pour', 'qui', 'sur', 'the', 'un', 'une', 'veux', 'want',
  'with', 'trie', 'trier', 'sorted', 'sort', 'donne', 'propose', 'cherche', 'someone',
]);

let embeddingPipeline = null;
let embeddingPipelinePromise = null;
let customEmbeddingProvider = null;
const embeddingCache = new Map();

const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
const round = (value, digits = 3) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeText = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeText = (value = '') =>
  normalizeText(value)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));

const cosineSimilarity = (left = [], right = []) => {
  if (!left.length || !right.length || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const normalizeVector = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
  if (!norm) return vector.map(() => 0);
  return vector.map((value) => value / norm);
};

const simpleHash = (value) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const createFallbackVector = (text) => {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  tokenizeText(text).forEach((token, position) => {
    const slot = (simpleHash(`${token}:${position % 7}`)) % EMBEDDING_DIMENSION;
    vector[slot] += 1 + Math.min(token.length / 10, 1);
  });
  return normalizeVector(vector);
};

const trimCache = () => {
  while (embeddingCache.size > MAX_CACHED_EMBEDDINGS) {
    const oldestKey = embeddingCache.keys().next().value;
    embeddingCache.delete(oldestKey);
  }
};

const unwrapTensorRows = (output, expectedRows) => {
  if (!output) return [];
  if (typeof output.tolist === 'function') {
    const list = output.tolist();
    return Array.isArray(list[0]) ? list : [list];
  }

  if (Array.isArray(output)) {
    return Array.isArray(output[0]) ? output : [output];
  }

  if (output.data && Array.isArray(output.dims)) {
    const flat = Array.from(output.data);
    if (output.dims.length === 1) return [flat];
    const rows = output.dims[0] || expectedRows || 1;
    const cols = output.dims[1] || Math.floor(flat.length / rows) || EMBEDDING_DIMENSION;
    return Array.from({ length: rows }, (_, rowIndex) =>
      flat.slice(rowIndex * cols, (rowIndex + 1) * cols)
    );
  }

  return [];
};

async function getEmbeddingPipeline() {
  if (embeddingPipeline) return embeddingPipeline;
  if (embeddingPipelinePromise) return embeddingPipelinePromise;

  embeddingPipelinePromise = (async () => {
    const { pipeline } = await import('@xenova/transformers');
    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL);
    return embeddingPipeline;
  })();

  embeddingPipelinePromise.catch(() => {
    embeddingPipeline = null;
    embeddingPipelinePromise = null;
  });

  return embeddingPipelinePromise;
}

async function embedTexts(texts = []) {
  const normalizedTexts = texts.map((text) => normalizeText(text || ''));
  if (!normalizedTexts.length) return [];

  if (customEmbeddingProvider) {
    const vectors = await customEmbeddingProvider(normalizedTexts);
    return vectors.map((vector) => normalizeVector(Array.from(vector || [])));
  }

  const pendingTexts = [];
  normalizedTexts.forEach((text) => {
    if (!embeddingCache.has(text)) pendingTexts.push(text);
  });

  if (pendingTexts.length > 0) {
    try {
      const extractor = await getEmbeddingPipeline();
      const output = await extractor(pendingTexts, { pooling: 'mean', normalize: true });
      const vectors = unwrapTensorRows(output, pendingTexts.length);

      pendingTexts.forEach((text, index) => {
        const vector = normalizeVector(Array.from(vectors[index] || createFallbackVector(text)));
        embeddingCache.set(text, vector);
      });
    } catch (error) {
      pendingTexts.forEach((text) => {
        embeddingCache.set(text, createFallbackVector(text));
      });
    }
    trimCache();
  }

  return normalizedTexts.map((text) => embeddingCache.get(text) || createFallbackVector(text));
}

const findNumericConstraint = (normalizedQuery, patterns) => {
  for (const pattern of patterns) {
    const match = normalizedQuery.match(pattern);
    if (match?.[1]) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) return value;
    }
  }
  return null;
};

const detectMatchedDomains = (normalizedQuery) =>
  Object.entries(SPECIALIZATION_SYNONYMS)
    .filter(([domain, keywords]) => [domain, ...keywords].some((keyword) => normalizedQuery.includes(normalizeText(keyword))))
    .map(([domain]) => domain);

const detectMatchedLocations = (normalizedQuery) =>
  KNOWN_LOCATIONS.filter((location) => normalizedQuery.includes(normalizeText(location)));

const detectSortPreference = (normalizedQuery) => {
  const isAsc = /ascending|croissant|lowest|smallest|minimum|minimal/.test(normalizedQuery);

  if (/rating|note|score|best score|meilleur score|meilleure note|top|meilleur|excellence|descendante|descendant/.test(normalizedQuery)) {
    return {
      field: 'rating',
      direction: isAsc ? 'asc' : 'desc',
      weights: { semantic: 10, reliability: 80, experience: 10 },
      reliabilityMix: { rating: 0.8, completedProjects: 0.1, activity: 0.1 },
    };
  }

  if (/projets finis|projets termines|completed projects|most completed|plus grand nombre de projets|most projects/.test(normalizedQuery)) {
    return {
      field: 'completedProjects',
      direction: isAsc ? 'asc' : 'desc',
      weights: { semantic: 15, reliability: 70, experience: 15 },
      reliabilityMix: { rating: 0.15, completedProjects: 0.75, activity: 0.1 },
    };
  }

  if (/experience|exp erience|ans d experience|years experience|most experienced|plus experimente/.test(normalizedQuery)) {
    return {
      field: 'yearsExperience',
      direction: isAsc ? 'asc' : 'desc',
      weights: { semantic: 10, reliability: 10, experience: 80 },
      reliabilityMix: { rating: 0.65, completedProjects: 0.15, activity: 0.2 },
    };
  }

  return {
    field: 'finalScore',
    direction: 'desc',
    weights: { semantic: 50, reliability: 30, experience: 20 },
    reliabilityMix: { rating: 0.65, completedProjects: 0.25, activity: 0.1 },
  };
};

const analyzeIntent = (query) => {
  const normalizedQuery = normalizeText(query);
  const matchedDomains = detectMatchedDomains(normalizedQuery);
  const matchedLocations = detectMatchedLocations(normalizedQuery);
  const minYearsExperience = findNumericConstraint(normalizedQuery, [
    /(?:plus de|over|more than|au moins|at least|min(?:imum)?|>=?)\s*(\d+)\s*(?:ans|annee|annees|years|year)?/,
    /(\d+)\s*(?:\+|plus)\s*(?:ans|annee|annees|years|year)/,
    /(\d+)\s*(?:ans|annee|annees|years|year)\s*d?\s*experience/,
  ]);
  const minRating = findNumericConstraint(normalizedQuery, [
    /(?:rating|note|score)\s*(?:>=?|above|plus de|au moins|over)\s*(\d+(?:\.\d+)?)/,
    /(\d+(?:\.\d+)?)\s*\/\s*5/,
  ]);
  const minCompletedProjects = findNumericConstraint(normalizedQuery, [
    /(?:plus de|over|at least|au moins)\s*(\d+)\s*(?:projets|projects)/,
  ]);
  const requiresCertification = /certif|certified|licensed|agree|agrement/.test(normalizedQuery);
  const sortPreference = detectSortPreference(normalizedQuery);

  const semanticTerms = new Set(tokenizeText(query));
  matchedDomains.forEach((domain) => {
    tokenizeText(domain).forEach((token) => semanticTerms.add(token));
    SPECIALIZATION_SYNONYMS[domain].forEach((term) => tokenizeText(term).forEach((token) => semanticTerms.add(token)));
  });
  matchedLocations.forEach((location) => tokenizeText(location).forEach((token) => semanticTerms.add(token)));

  const hasProjectNarrative = /mon projet|je construis|je renove|renovation|repair|reparation|réparation|fix|installer|installation|mount|walls|mur|murs|lavabo|villa|bathroom|kitchen|cuisine/.test(normalizedQuery);
  const hasSemanticIntent = hasProjectNarrative || semanticTerms.size >= 3 || matchedDomains.length > 0;

  return {
    rawQuery: String(query || '').trim(),
    normalizedQuery,
    matchedDomains,
    matchedLocations,
    minYearsExperience,
    minRating,
    minCompletedProjects,
    requiresCertification,
    sortPreference,
    semanticTerms: Array.from(semanticTerms),
    hasSemanticIntent,
  };
};

const buildMongoFilter = (analysis) => {
  const filter = { status: 'active' };
  const andClauses = [];

  if (analysis.minYearsExperience !== null) {
    andClauses.push({ yearsExperience: { $gte: analysis.minYearsExperience } });
  }

  if (analysis.requiresCertification) {
    andClauses.push({ certifications: { $exists: true, $ne: [] } });
  }

  if (analysis.matchedDomains.length > 0) {
    const domainRegexList = analysis.matchedDomains
      .flatMap((domain) => [domain, ...SPECIALIZATION_SYNONYMS[domain]])
      .map((entry) => new RegExp(escapeRegex(entry), 'i'));

    andClauses.push({
      $or: [
        { domain: { $in: domainRegexList } },
        { bio: { $in: domainRegexList } },
        { skills: { $in: domainRegexList } },
        { certifications: { $in: domainRegexList } },
      ],
    });
  }

  if (analysis.matchedLocations.length > 0) {
    andClauses.push({
      $or: analysis.matchedLocations.map((location) => ({
        location: new RegExp(escapeRegex(location), 'i'),
      })),
    });
  }

  if (andClauses.length > 0) filter.$and = andClauses;
  return filter;
};

const buildProjectText = (project = {}) =>
  [project.title, project.description, project.location].filter(Boolean).join('. ');

const buildSemanticProfileText = (artisan = {}) => {
  const projectTexts = (artisan.completedProjectDetails || []).map(buildProjectText);
  return [
    artisan.firstName,
    artisan.lastName,
    artisan.domain,
    artisan.location,
    artisan.bio,
    ...(artisan.skills || []),
    ...(artisan.certifications || []),
    ...projectTexts,
  ]
    .filter(Boolean)
    .join('. ');
};

const normalizeProjectsScore = (completedProjects, maxProjects) => {
  if (!maxProjects) return 0;
  return clamp(Math.log1p(completedProjects) / Math.log1p(maxProjects), 0, 1);
};

const computeActivityScore = (artisan = {}, now = new Date()) => {
  if (artisan.status !== 'active') return 0;

  const dates = [
    artisan.lastLoginAt,
    artisan.lastActionAt,
    artisan.lastProjectActivityAt,
    artisan.lastReviewAt,
  ]
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (!dates.length) return 0.25;

  const latest = new Date(Math.max(...dates.map((value) => value.getTime())));
  const diffDays = Math.floor((now.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 30) return 1;
  if (diffDays <= 90) return 0.82;
  if (diffDays <= 180) return 0.62;
  if (diffDays <= 365) return 0.38;
  return 0.18;
};

const getActivityPenalty = (activityScore) => {
  if (activityScore >= 0.75) return 1;
  if (activityScore >= 0.5) return 0.85;
  if (activityScore >= 0.3) return 0.68;
  return 0.45;
};

const extractProjectHighlights = (projectMatches = [], minSimilarity = 0.45) => {
  const similarProjects = projectMatches.filter((entry) => entry.similarity >= minSimilarity);
  const examples = similarProjects.slice(0, 2).map((entry) => entry.title).filter(Boolean);
  return {
    similarProjectsCount: similarProjects.length,
    examples,
    bestProjectSimilarity: similarProjects[0]?.similarity || projectMatches[0]?.similarity || 0,
  };
};

const buildReasonSummary = (artisan, explanation) => {
  const parts = [];
  if (artisan.yearsExperience) parts.push(`${artisan.yearsExperience} ans d'expérience`);
  if (artisan.rating > 0) parts.push(`noté ${artisan.rating.toFixed(1)}/5`);
  if (explanation.similarProjectsCount > 0) {
    const exampleText = explanation.examples.length ? ` (ex: '${explanation.examples.join(`', '`)}')` : '';
    parts.push(`a déjà réalisé ${explanation.similarProjectsCount} projet(s) similaire(s)${exampleText}`);
  } else if (artisan.completedProjects > 0) {
    parts.push(`${artisan.completedProjects} projet(s) terminé(s)`);
  }
  return `Match à ${explanation.matchPercent}% : ${parts.join(', ')}.`;
};

const buildContextualReasonSummary = (analysis, artisan, explanation) => {
  const exampleText = explanation.examples.length ? ` (ex: '${explanation.examples[0]}')` : '';

  if ((analysis.hasSemanticIntent || analysis.matchedDomains.length > 0) && explanation.similarProjectsCount > 0) {
    return `Correspondance forte avec le projet : a déjà réalisé ${explanation.similarProjectsCount} projet(s) similaire(s)${exampleText}.`;
  }

  if (analysis.sortPreference.field === 'rating' || /meilleur|top|excellence/.test(analysis.normalizedQuery)) {
    return `Sélectionné pour son excellence : noté ${artisan.rating.toFixed(1)}/5 par les experts.`;
  }

  if (analysis.sortPreference.field === 'yearsExperience' || analysis.minYearsExperience !== null) {
    return `Profil Senior : possède ${artisan.yearsExperience || 0} ans d'expérience dans le domaine.`;
  }

  if (analysis.sortPreference.field === 'completedProjects' || analysis.minCompletedProjects !== null) {
    return `Choisi pour sa régularité : ${artisan.completedProjects} projet(s) terminé(s) avec succès.`;
  }

  if (artisan.rating >= 4.5) {
    return `Profil recommandé : noté ${artisan.rating.toFixed(1)}/5 avec une réputation solide auprès des experts.`;
  }

  if (explanation.similarProjectsCount > 0) {
    return `Correspond à votre besoin : dispose déjà d'un historique de projets proches de votre demande${exampleText}.`;
  }

  return `Profil pertinent pour votre recherche : compétences et expérience cohérentes avec le besoin décrit.`;
};

const buildMatchHighlights = (artisan, explanation) => {
  const highlights = [];
  if (Number(artisan.rating || 0) > 4.5) highlights.push('⭐ Top Note');
  if (Number(explanation.similarProjectsCount || 0) > 0) highlights.push('🏗️ Projets Similaires');
  if (Number(artisan.yearsExperience || 0) > 10) highlights.push('🏅 Profil Expérimenté');
  if (Number(artisan.completedProjects || 0) > 15) highlights.push('✅ Très Actif');
  if (Number(artisan.completedProjects || 0) > 5 && Number(artisan.rating || 0) >= 4) highlights.push('🤝 Fiable');
  return highlights.slice(0, 4);
};

const compareWithSortPreference = (left, right, analysis) => {
  const { field, direction } = analysis.sortPreference;
  const multiplier = direction === 'asc' ? 1 : -1;
  const leftValue = Number(left[field] || 0);
  const rightValue = Number(right[field] || 0);
  if (leftValue !== rightValue) return (leftValue - rightValue) * multiplier;
  return right.finalScore - left.finalScore;
};

const searchArtisansWithAI = async (artisans, query, options = {}) => {
  const { limit = DEFAULT_LIMIT } = options;
  const analysis = analyzeIntent(query);
  const activeArtisans = artisans.filter((artisan) => artisan.status === 'active');
  const maxima = activeArtisans.reduce((accumulator, artisan) => ({
    rating: Math.max(accumulator.rating, Number(artisan.rating || 0)),
    completedProjects: Math.max(accumulator.completedProjects, Number(artisan.completedProjects || 0)),
    yearsExperience: Math.max(accumulator.yearsExperience, Number(artisan.yearsExperience || 0)),
  }), { rating: 5, completedProjects: 1, yearsExperience: 1 });

  const semanticTexts = activeArtisans.map(buildSemanticProfileText);
  const [queryEmbedding] = await embedTexts([analysis.rawQuery]);
  const artisanEmbeddings = await embedTexts(semanticTexts);
  const projectEmbeddings = await Promise.all(activeArtisans.map((artisan) =>
    embedTexts((artisan.completedProjectDetails || []).map(buildProjectText))
  ));

  const ranked = activeArtisans.map((artisan, index) => {
    const activityScore = computeActivityScore(artisan);
    const activityPenalty = getActivityPenalty(activityScore);
    const ratingScore = clamp(Number(artisan.rating || 0) / 5, 0, 1);
    const completedProjectsScore = normalizeProjectsScore(Number(artisan.completedProjects || 0), maxima.completedProjects);
    const experienceScore = clamp(Number(artisan.yearsExperience || 0) / Math.max(maxima.yearsExperience, analysis.minYearsExperience || 1), 0, 1);
    const profileSimilarity = cosineSimilarity(queryEmbedding, artisanEmbeddings[index] || []);

    const projectMatches = (artisan.completedProjectDetails || []).map((project, projectIndex) => ({
      title: project.title || project.description || '',
      similarity: cosineSimilarity(queryEmbedding, projectEmbeddings[index]?.[projectIndex] || []),
    })).sort((left, right) => right.similarity - left.similarity);

    const highlights = extractProjectHighlights(projectMatches);
    const semanticScore = analysis.hasSemanticIntent
      ? clamp((profileSimilarity * 0.7) + (highlights.bestProjectSimilarity * 0.3), 0, 1)
      : 0.55;

    const reliabilityScore = clamp(
      (ratingScore * analysis.sortPreference.reliabilityMix.rating)
      + (completedProjectsScore * analysis.sortPreference.reliabilityMix.completedProjects)
      + (activityScore * analysis.sortPreference.reliabilityMix.activity),
      0,
      1
    );

    const weightedScore = (
      semanticScore * analysis.sortPreference.weights.semantic
      + reliabilityScore * analysis.sortPreference.weights.reliability
      + experienceScore * analysis.sortPreference.weights.experience
    );

    const finalScore = round(clamp(weightedScore * activityPenalty, 0, 100), 2);
    const matchPercent = Math.round(finalScore);
    const explanation = {
      matchPercent,
      similarProjectsCount: highlights.similarProjectsCount,
      examples: highlights.examples,
    };

    return {
      ...artisan,
      finalScore,
      aiScore: round(finalScore / 100, 4),
      aiMatchPercent: matchPercent,
      similarProjectsCount: explanation.similarProjectsCount,
      similarProjectExamples: explanation.examples,
      aiReason: buildContextualReasonSummary(analysis, artisan, explanation),
      matchReasons: [
        `Sémantique: ${Math.round(explanation.semanticScore * 100)}%`,
        `Fiabilité: ${Math.round(explanation.reliabilityScore * 100)}%`,
        `Expérience: ${Math.round(explanation.experienceScore * 100)}%`,
      ],
    };
  }).filter((artisan) => {
    if (analysis.minYearsExperience !== null && Number(artisan.yearsExperience || 0) < analysis.minYearsExperience) return false;
    if (analysis.minRating !== null && Number(artisan.rating || 0) < analysis.minRating) return false;
    if (analysis.minCompletedProjects !== null && Number(artisan.completedProjects || 0) < analysis.minCompletedProjects) return false;
    if (analysis.requiresCertification && (!Array.isArray(artisan.certifications) || artisan.certifications.length === 0)) return false;
    return artisan.finalScore > 0;
  });

  ranked.sort((left, right) => compareWithSortPreference(left, right, analysis));

  return {
    analysis: {
      query: analysis.rawQuery,
      matchedDomains: analysis.matchedDomains,
      matchedLocations: analysis.matchedLocations,
      minYearsExperience: analysis.minYearsExperience,
      minRating: analysis.minRating,
      minCompletedProjects: analysis.minCompletedProjects,
      requiresCertification: analysis.requiresCertification,
      sortBy: analysis.sortPreference.field,
      sortDirection: analysis.sortPreference.direction,
      appliedWeights: analysis.sortPreference.weights,
      semanticMode: customEmbeddingProvider ? 'test-provider' : `embeddings:${EMBEDDING_MODEL}`,
    },
    artisans: ranked.slice(0, limit).map((artisan) => {
      const {
        semanticScore,
        reliabilityScore,
        experienceScore,
        activityScore,
        matchReasons,
        ...safeArtisan
      } = artisan;

      return {
        ...safeArtisan,
        matchHighlights: buildMatchHighlights(artisan, {
          similarProjectsCount: artisan.similarProjectsCount,
        }),
      };
    }),
  };
};

const __setEmbeddingProviderForTests = (provider) => {
  customEmbeddingProvider = provider;
};

const __resetEmbeddingProviderForTests = () => {
  customEmbeddingProvider = null;
};

module.exports = {
  analyzeIntent,
  buildMongoFilter,
  searchArtisansWithAI,
  __setEmbeddingProviderForTests,
  __resetEmbeddingProviderForTests,
};
