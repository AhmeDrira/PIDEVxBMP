const Quote = require('../models/Quote');

let featurePipeline = null;
let featurePipelinePromise = null;

// Cache quote embeddings in-memory to reduce repeated model inference cost.
const quoteEmbeddingCache = new Map();
const MAX_EMBEDDING_CACHE_SIZE = 500;

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);
const safeNumber = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const LABOR_MATERIALS_EXPONENT = 0.85;
const LABOR_MATERIALS_SCALE = 2.5;

const estimateLaborFromMaterials = (materialsAmount, laborRatio) => {
  const safeMaterials = Math.max(0, Number(materialsAmount) || 0);
  const safeLaborRatio = Math.max(0, Number(laborRatio) || 0);

  if (safeMaterials <= 0 || safeLaborRatio <= 0) {
    return 0;
  }

  return Math.pow(safeMaterials, LABOR_MATERIALS_EXPONENT) * safeLaborRatio * LABOR_MATERIALS_SCALE;
};

const normalizeText = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const cacheSet = (key, value) => {
  if (quoteEmbeddingCache.size >= MAX_EMBEDDING_CACHE_SIZE) {
    const firstKey = quoteEmbeddingCache.keys().next().value;
    if (firstKey) {
      quoteEmbeddingCache.delete(firstKey);
    }
  }
  quoteEmbeddingCache.set(key, value);
};

const parsePaymentMode = (paymentTerms) => {
  const normalized = String(paymentTerms || '').toLowerCase();
  if (normalized.includes('fixed')) return 'fixed';
  if (normalized.includes('percentage') || normalized.includes('%')) return 'percentage';
  return 'percentage';
};

const toVector = (embeddingOutput) => {
  if (!embeddingOutput) return [];

  if (embeddingOutput.data && ArrayBuffer.isView(embeddingOutput.data)) {
    return Array.from(embeddingOutput.data).map((value) => Number(value));
  }

  if (Array.isArray(embeddingOutput)) {
    if (Array.isArray(embeddingOutput[0])) {
      return embeddingOutput[0].map((value) => Number(value));
    }
    return embeddingOutput.map((value) => Number(value));
  }

  return [];
};

const cosineSimilarity = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || b.length === 0) {
    return 0;
  }

  const size = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < size; i += 1) {
    const va = Number(a[i]) || 0;
    const vb = Number(b[i]) || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }

  if (normA <= 0 || normB <= 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const getFeaturePipeline = async () => {
  if (featurePipeline) return featurePipeline;
  if (featurePipelinePromise) return featurePipelinePromise;

  featurePipelinePromise = (async () => {
    const { pipeline } = await import('@xenova/transformers');
    featurePipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return featurePipeline;
  })();

  featurePipelinePromise.catch(() => {
    featurePipelinePromise = null;
    featurePipeline = null;
  });

  return featurePipelinePromise;
};

const embedText = async (text) => {
  const pipe = await getFeaturePipeline();
  const output = await pipe(normalizeText(text), {
    pooling: 'mean',
    normalize: true,
  });

  const vector = toVector(output);
  if (!vector.length) {
    throw new Error('Empty embedding vector produced by feature-extraction model.');
  }

  return vector;
};

const summarizeTaskText = (tasks) => {
  if (!Array.isArray(tasks) || tasks.length === 0) return 'no task list';
  const titles = tasks
    .map((task) => normalizeText(task?.title))
    .filter(Boolean)
    .slice(0, 8);
  return titles.length ? titles.join(', ') : 'no task titles';
};

const summarizeMaterialsText = (project) => {
  const marketplace = Array.isArray(project?.materials)
    ? project.materials
        .map((item) => normalizeText(item?.name))
        .filter(Boolean)
    : [];

  const personal = Array.isArray(project?.personalMaterials)
    ? project.personalMaterials
        .map((item) => normalizeText(item?.name))
        .filter(Boolean)
    : [];

  const all = [...marketplace, ...personal].slice(0, 12);
  return all.length ? all.join(', ') : 'no materials';
};

const projectToProfileText = (project, clientName) => {
  const title = normalizeText(project?.title);
  const description = normalizeText(project?.description);
  const location = normalizeText(project?.location);
  const priority = normalizeText(project?.priority || 'medium');
  const client = normalizeText(clientName || 'unknown client');
  const tasks = summarizeTaskText(project?.tasks);
  const materials = summarizeMaterialsText(project);

  return [
    `Project title: ${title}`,
    `Client: ${client}`,
    `Description: ${description}`,
    `Location: ${location}`,
    `Priority: ${priority}`,
    `Tasks: ${tasks}`,
    `Materials: ${materials}`,
  ].join(' | ');
};

const quoteToProfileText = (quote) => {
  const project = quote?.project || {};
  const projectPart = projectToProfileText(project, quote?.clientName);
  const labor = safeNumber(quote?.laborHand, 0);
  const materials = safeNumber(quote?.materialsAmount, 0);
  const total = safeNumber(quote?.amount, 0);
  const upfrontPercent = safeNumber(quote?.upfrontPercent, 50);
  const paymentMode = parsePaymentMode(quote?.paymentTerms);

  return [
    projectPart,
    `LaborHand: ${labor}`,
    `MaterialsAmount: ${materials}`,
    `TotalAmount: ${total}`,
    `UpfrontPercent: ${upfrontPercent}`,
    `PaymentMode: ${paymentMode}`,
  ].join(' | ');
};

const quoteEmbeddingCacheKey = (quote) => {
  const id = String(quote?._id || '');
  const updatedAt = quote?.updatedAt ? new Date(quote.updatedAt).getTime() : 0;
  return `${id}:${updatedAt}`;
};

const getQuoteEmbedding = async (quote) => {
  const key = quoteEmbeddingCacheKey(quote);
  if (quoteEmbeddingCache.has(key)) {
    return quoteEmbeddingCache.get(key);
  }

  const embedding = await embedText(quoteToProfileText(quote));
  cacheSet(key, embedding);
  return embedding;
};

const weightedAverage = (rows, extractValue) => {
  let weightedSum = 0;
  let weightTotal = 0;

  rows.forEach((row) => {
    const value = extractValue(row);
    if (!Number.isFinite(value)) return;

    const weight = Math.max(Number(row?.similarity) || 0, 0.0001);
    weightedSum += value * weight;
    weightTotal += weight;
  });

  if (weightTotal <= 0) return null;
  return weightedSum / weightTotal;
};

const predictQuoteDraftFromHistory = async ({
  artisanId,
  project,
  clientName,
  currentMaterialsAmount,
  minHistory = 3,
  maxCandidates = 80,
  topK = 5,
}) => {
  if (!artisanId) {
    return {
      ok: false,
      reason: 'missing-artisan-id',
      historyCount: 0,
      neighborsUsed: 0,
    };
  }

  const approvedQuotes = await Quote.find({ artisan: artisanId, status: 'approved' })
    .sort({ createdAt: -1 })
    .limit(maxCandidates)
    .populate({
      path: 'project',
      select: 'title description location priority tasks materials personalMaterials startDate endDate status progress',
      populate: {
        path: 'materials',
        select: 'name price category status',
      },
    })
    .lean();

  const validHistory = approvedQuotes.filter((quote) => quote && quote.project && safeNumber(quote.amount, 0) > 0);

  if (validHistory.length < minHistory) {
    return {
      ok: false,
      reason: 'insufficient-history',
      historyCount: validHistory.length,
      neighborsUsed: 0,
      requiredHistory: minHistory,
    };
  }

  let targetEmbedding;
  try {
    targetEmbedding = await embedText(projectToProfileText(project, clientName));
  } catch (error) {
    return {
      ok: false,
      reason: 'model-load-failed',
      historyCount: validHistory.length,
      neighborsUsed: 0,
      errorMessage: error.message,
    };
  }

  const scored = [];
  for (const quote of validHistory) {
    try {
      const embedding = await getQuoteEmbedding(quote);
      const similarity = cosineSimilarity(targetEmbedding, embedding);
      if (Number.isFinite(similarity)) {
        scored.push({ quote, similarity });
      }
    } catch (_error) {
      // Skip invalid embedding entries and continue with remaining history.
    }
  }

  if (!scored.length) {
    return {
      ok: false,
      reason: 'embedding-failed',
      historyCount: validHistory.length,
      neighborsUsed: 0,
    };
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  const neighbors = scored.slice(0, Math.min(topK, scored.length));

  const averageSimilarity =
    neighbors.reduce((sum, row) => sum + (Number(row.similarity) || 0), 0) / neighbors.length;

  const laborRatio = weightedAverage(neighbors, ({ quote }) => {
    const labor = safeNumber(quote?.laborHand, 0);
    const materials = safeNumber(quote?.materialsAmount, 0);
    if (materials > 0) {
      const materialLaborBase = Math.pow(materials, LABOR_MATERIALS_EXPONENT) * LABOR_MATERIALS_SCALE;
      if (materialLaborBase > 0) return labor / materialLaborBase;
    }
    const amount = safeNumber(quote?.amount, 0);
    return amount > 0 ? labor / amount : null;
  });

  const weightedLabor = weightedAverage(neighbors, ({ quote }) => safeNumber(quote?.laborHand, 0));

  let laborHandPrediction = weightedLabor || 0;
  if (safeNumber(currentMaterialsAmount, 0) > 0 && Number.isFinite(laborRatio)) {
    laborHandPrediction = estimateLaborFromMaterials(safeNumber(currentMaterialsAmount, 0), laborRatio);
  }

  laborHandPrediction = Math.max(0, laborHandPrediction);

  const upfrontPercent = weightedAverage(
    neighbors,
    ({ quote }) => clamp(safeNumber(quote?.upfrontPercent, 50), 0, 100)
  );

  const paymentVotes = neighbors.reduce(
    (acc, row) => {
      const mode = parsePaymentMode(row?.quote?.paymentTerms);
      const weight = Math.max(Number(row.similarity) || 0, 0.0001);
      acc[mode] += weight;
      return acc;
    },
    { percentage: 0, fixed: 0 }
  );

  const paymentType = paymentVotes.fixed > paymentVotes.percentage ? 'fixed' : 'percentage';

  const confidence = clamp(((averageSimilarity + 1) / 2) * (0.7 + Math.min(neighbors.length, 5) * 0.06), 0.35, 0.97);

  return {
    ok: true,
    model: 'Xenova/all-MiniLM-L6-v2',
    method: 'embedding-rag-nearest-neighbors',
    confidence,
    historyCount: validHistory.length,
    neighborsUsed: neighbors.length,
    averageSimilarity,
    predictions: {
      laborHand: laborHandPrediction,
      laborRatio: Number.isFinite(laborRatio) ? laborRatio : null,
      upfrontPercent: Number.isFinite(upfrontPercent) ? upfrontPercent : 50,
      paymentType,
    },
    neighbors: neighbors.map(({ quote, similarity }) => ({
      quoteId: String(quote?._id || ''),
      quoteNumber: String(quote?.quoteNumber || ''),
      similarity,
      laborHand: safeNumber(quote?.laborHand, 0),
      amount: safeNumber(quote?.amount, 0),
      upfrontPercent: clamp(safeNumber(quote?.upfrontPercent, 50), 0, 100),
      paymentMode: parsePaymentMode(quote?.paymentTerms),
      projectTitle: normalizeText(quote?.project?.title || 'Untitled project'),
    })),
  };
};

module.exports = {
  predictQuoteDraftFromHistory,
};
