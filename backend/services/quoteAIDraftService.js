const { predictQuoteDraftFromHistory } = require('./quoteMLService');

const clamp = (value, min, max) => Math.min(Math.max(Number(value) || 0, min), max);

const roundCurrency = (value) => Number((Number(value) || 0).toFixed(2));

const formatPercent = (value) => `${roundCurrency(value).toFixed(2)}%`;

const daysBetween = (from, to) => {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }
  const dayMs = 1000 * 60 * 60 * 24;
  return Math.ceil((toDate.getTime() - fromDate.getTime()) / dayMs);
};

const toIsoDate = (date) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const addDaysIso = (days) => {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + Math.max(1, Math.round(days)));
  return toIsoDate(next);
};

const extractMaterialItems = (project) => {
  const groupedMarketplace = Array.isArray(project?.materials)
    ? Object.values(
        project.materials.reduce((acc, mat) => {
          const id = String((mat && (mat._id || mat)) || '');
          if (!id) return acc;
          if (!acc[id]) {
            acc[id] = {
              name: String(mat?.name || 'Marketplace material'),
              quantity: 0,
              unitPrice: Number(mat?.price) || 0,
              source: 'marketplace',
              category: String(mat?.category || ''),
              status: String(mat?.status || 'active'),
            };
          }
          acc[id].quantity += 1;
          return acc;
        }, {})
      )
    : [];

  const personalMaterials = Array.isArray(project?.personalMaterials)
    ? project.personalMaterials
        .filter((item) => item && item.name)
        .map((item) => {
          const quantity = Number(item?.stock);
          return {
            name: String(item.name),
            quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            unitPrice: Number(item?.price) || 0,
            source: 'personal',
            category: String(item?.category || ''),
            status: 'custom',
          };
        })
    : [];

  return [...groupedMarketplace, ...personalMaterials];
};

const summarizeList = (items, emptyLabel) => {
  if (!Array.isArray(items) || items.length === 0) return emptyLabel;
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, 2).join(', ')}, and ${items.length - 2} more`;
};

const riskToLevel = (risk) => {
  if (risk >= 70) return 'high';
  if (risk >= 40) return 'medium';
  return 'low';
};

const computeUpfrontPercent = (overallRisk) => {
  if (overallRisk < 40) {
    return 20 + (overallRisk / 40) * 10;
  }
  if (overallRisk < 70) {
    return 30 + ((overallRisk - 40) / 30) * 10;
  }
  return 40 + ((overallRisk - 70) / 30) * 20;
};

const confidenceFromCompleteness = ({
  hasTasks,
  hasMaterials,
  hasClient,
  hasDescription,
  warningsCount,
}) => {
  const completeness =
    (hasTasks ? 0.25 : 0) +
    (hasMaterials ? 0.35 : 0) +
    (hasClient ? 0.2 : 0) +
    (hasDescription ? 0.2 : 0);

  return clamp(0.45 + completeness * 0.5 - warningsCount * 0.02, 0.4, 0.95);
};

const buildQuoteDescription = ({
  project,
  taskTitles,
  materialNames,
  durationDays,
  validityDays,
  riskLevel,
}) => {
  const location = String(project?.location || 'the project site');
  const projectTitle = String(project?.title || 'Project');
  const projectDescription = String(project?.description || '').trim();

  const scope = projectDescription
    ? projectDescription
    : `Execution and completion of ${projectTitle} works according to approved specifications.`;

  const tasksSummary = summarizeList(taskTitles, 'General installation, preparation, and finishing activities');
  const materialsSummary = summarizeList(materialNames, 'Materials to be validated before work starts');

  return [
    `Scope: ${scope}`,
    `Included works: ${tasksSummary}.`,
    `Materials included: ${materialsSummary}.`,
    `Schedule basis: planned duration around ${durationDays} day(s) at ${location}.`,
    `Commercial condition: pricing validity is ${validityDays} day(s) due to ${riskLevel} market and execution risk.`,
    'Exclusions: hidden defects, design changes requested after start, and third-party permit fees unless explicitly added.',
  ].join('\n\n');
};

const resolveFallbackReasonLabel = (reason, historyCount, requiredHistory = 3) => {
  switch (String(reason || '')) {
    case 'missing-artisan-id':
      return 'ML history lookup skipped because artisan ID was not provided.';
    case 'insufficient-history':
      return `ML history lookup skipped: ${historyCount || 0} approved quotes found, at least ${requiredHistory} are required.`;
    case 'model-load-failed':
      return 'ML model could not be loaded, heuristic fallback was used.';
    case 'embedding-failed':
      return 'ML embedding similarity failed, heuristic fallback was used.';
    default:
      return 'ML inference fallback applied due to unavailable historical signal.';
  }
};

const toUiSimilarity = (rawSimilarity) => {
  const raw = Number(rawSimilarity) || 0;
  return roundCurrency(clamp(((raw + 1) / 2) * 100, 0, 100));
};

const generateQuoteAIDraft = async ({ project, clientName, artisanId }) => {
  const materialItems = extractMaterialItems(project);
  const materialsAmount = roundCurrency(
    materialItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0)
  );

  const tasks = Array.isArray(project?.tasks) ? project.tasks : [];
  const taskCount = tasks.length;
  const doneCount = tasks.filter((task) => String(task?.status || '') === 'done').length;
  const completionRatio = taskCount > 0 ? doneCount / taskCount : 0;

  const startDate = toIsoDate(project?.startDate) || toIsoDate(new Date()) || new Date().toISOString().slice(0, 10);
  const endDate = toIsoDate(project?.endDate) || addDaysIso(30);
  const durationDaysRaw = daysBetween(startDate, endDate);
  const durationDays = durationDaysRaw === null ? 30 : Math.max(1, durationDaysRaw);
  const daysToDeadlineRaw = daysBetween(new Date(), endDate);
  const daysToDeadline = daysToDeadlineRaw === null ? durationDays : daysToDeadlineRaw;

  const priority = String(project?.priority || 'medium').toLowerCase();
  const priorityBoost = priority === 'high' ? 20 : priority === 'low' ? 4 : 10;

  const uniqueCategories = new Set(
    materialItems
      .map((item) => String(item.category || '').trim())
      .filter(Boolean)
  ).size;

  const personalCount = materialItems.filter((item) => item.source === 'personal').length;
  const lowStockCount = materialItems.filter(
    (item) => item.source === 'marketplace' && ['low-stock', 'out-of-stock'].includes(String(item.status || '').toLowerCase())
  ).length;

  const expensiveAmount = materialItems.reduce((sum, item) => {
    if (Number(item.unitPrice) >= 500) {
      return sum + Number(item.unitPrice || 0) * Number(item.quantity || 0);
    }
    return sum;
  }, 0);

  const expensiveShare = materialsAmount > 0 ? expensiveAmount / materialsAmount : 0;
  const lowStockRatio = materialItems.length > 0 ? lowStockCount / materialItems.length : 0;
  const personalShare = materialItems.length > 0 ? personalCount / materialItems.length : 0;

  const trimmedClient = String(clientName || '').trim();

  let riskClient = 28;
  if (!trimmedClient) riskClient += 28;
  if (trimmedClient && trimmedClient.length < 4) riskClient += 10;
  if (materialsAmount > 12000) riskClient += 10;
  if (durationDays > 45) riskClient += 8;
  if (completionRatio > 0.7) riskClient -= 6;
  riskClient = clamp(riskClient, 8, 95);

  let riskDelay = 20 + priorityBoost;
  if (daysToDeadline <= 7) riskDelay += 30;
  else if (daysToDeadline <= 14) riskDelay += 22;
  else if (daysToDeadline <= 30) riskDelay += 12;
  if (taskCount > 10) riskDelay += 10;
  if (completionRatio > 0.65) riskDelay -= 10;
  riskDelay = clamp(riskDelay, 5, 98);

  let riskTechnical = 18;
  if (taskCount > 12) riskTechnical += 24;
  else if (taskCount > 7) riskTechnical += 16;
  else if (taskCount > 3) riskTechnical += 8;

  if (uniqueCategories > 6) riskTechnical += 18;
  else if (uniqueCategories > 3) riskTechnical += 10;

  if (expensiveShare > 0.45) riskTechnical += 12;
  else if (expensiveShare > 0.25) riskTechnical += 7;

  if (personalShare > 0.3) riskTechnical += 8;
  if (completionRatio > 0.8) riskTechnical -= 8;
  riskTechnical = clamp(riskTechnical, 8, 96);

  let riskPrice = 20;
  riskPrice += lowStockRatio * 35;
  riskPrice += expensiveShare * 30;
  riskPrice += personalShare * 12;
  if (materialsAmount > 15000) riskPrice += 10;
  if (materialsAmount > 0 && materialsAmount < 1500) riskPrice -= 5;
  riskPrice = clamp(riskPrice, 5, 97);

  const overallRisk = roundCurrency(
    clamp(
      0.35 * riskClient +
      0.25 * riskDelay +
      0.2 * riskTechnical +
      0.2 * riskPrice,
      0,
      100
    )
  );

  const riskLevel = riskToLevel(overallRisk);

  const laborRatio = clamp(
    0.42 +
      (riskTechnical / 100) * 0.35 +
      (riskDelay / 100) * 0.15 +
      (taskCount > 8 ? 0.08 : taskCount > 4 ? 0.04 : 0) +
      (priority === 'high' ? 0.05 : 0) -
      completionRatio * 0.08,
    0.35,
    1.2
  );

  let laborHand = materialsAmount > 0 ? materialsAmount * laborRatio : taskCount > 0 ? taskCount * 220 : 350;
  if (priority === 'high') laborHand *= 1.08;
  if (daysToDeadline <= 14) laborHand *= 1.1;
  laborHand = roundCurrency(laborHand);

  const totalEstimated = roundCurrency(laborHand + materialsAmount);

  const paymentType =
    overallRisk >= 65 || totalEstimated >= 12000 || daysToDeadline > 45
      ? 'percentage'
      : 'fixed';

  const upfrontPercent = roundCurrency(clamp(computeUpfrontPercent(overallRisk), 0, 100));
  const upfrontFixedAmount = roundCurrency((totalEstimated * upfrontPercent) / 100);

  const validityDays = overallRisk >= 70 ? 10 : overallRisk >= 55 ? 14 : overallRisk >= 40 ? 21 : 30;
  const validUntil = addDaysIso(validityDays);

  const warnings = [];
  if (!trimmedClient) warnings.push('Client profile is missing, payment behavior risk was increased.');
  if (taskCount === 0) warnings.push('No task breakdown found, technical estimate uses default workload assumptions.');
  if (materialItems.length === 0) warnings.push('No priced materials found on this project, labor estimate uses baseline values.');
  if (lowStockCount > 0) warnings.push(`${lowStockCount} marketplace material(s) are low or out of stock, pricing can shift quickly.`);
  if (daysToDeadline <= 14) warnings.push('Short timeline detected, labor intensity and upfront recommendation were increased.');
  if (daysToDeadline < 0) warnings.push('Project deadline is already passed, review schedule assumptions before sending the quote.');

  const assumptions = [
    'Final quote amount remains deterministic on save: amount = laborHand + materialsAmount.',
    'Labor estimate is derived from task load, timeline pressure, and material complexity.',
    'Upfront recommendation follows weighted risk model: client 35%, delay 25%, technical 20%, price 20%.',
  ];

  if (personalCount > 0) {
    assumptions.push('Personal material prices are assumed up-to-date and available for procurement.');
  }

  if (!project?.location) {
    assumptions.push('Travel and logistics constraints were estimated using a neutral location assumption.');
  }

  const taskTitles = tasks
    .map((task) => String(task?.title || '').trim())
    .filter(Boolean)
    .slice(0, 5);

  const materialNames = materialItems
    .map((item) => String(item?.name || '').trim())
    .filter(Boolean)
    .slice(0, 6);

  const description = buildQuoteDescription({
    project,
    taskTitles,
    materialNames,
    durationDays,
    validityDays,
    riskLevel,
  });

  const baseConfidence = confidenceFromCompleteness({
    hasTasks: taskCount > 0,
    hasMaterials: materialItems.length > 0,
    hasClient: Boolean(trimmedClient),
    hasDescription: Boolean(String(project?.description || '').trim()),
    warningsCount: warnings.length,
  });

  const laborConfidence = clamp(baseConfidence + (materialsAmount > 0 ? 0.08 : -0.05), 0.4, 0.98);
  const paymentConfidence = clamp(baseConfidence + 0.03, 0.4, 0.98);
  const descriptionConfidence = clamp(baseConfidence - (taskCount === 0 ? 0.07 : 0), 0.35, 0.95);

  let finalLaborHand = laborHand;
  let finalLaborRatio = laborRatio;
  let finalPaymentType = paymentType;
  let finalUpfrontPercent = upfrontPercent;
  let finalUpfrontFixedAmount = upfrontFixedAmount;
  let finalUpfrontValue = paymentType === 'percentage' ? upfrontPercent : upfrontFixedAmount;
  let finalTotalEstimated = totalEstimated;
  let finalLaborConfidence = laborConfidence;
  let finalPaymentConfidence = paymentConfidence;

  const inference = {
    source: 'heuristic-fallback',
    model: 'none',
    method: 'rule-based',
    confidence: roundCurrency(baseConfidence),
    historyCount: 0,
    neighborsUsed: 0,
    averageSimilarity: null,
    fallbackReason: null,
    neighbors: [],
  };

  try {
    const mlResult = await predictQuoteDraftFromHistory({
      artisanId,
      project,
      clientName: trimmedClient,
      currentMaterialsAmount: materialsAmount,
    });

    if (mlResult.ok) {
      const mlLaborHand = roundCurrency(Math.max(0, Number(mlResult?.predictions?.laborHand) || finalLaborHand));
      const mlPaymentType = mlResult?.predictions?.paymentType === 'fixed' ? 'fixed' : 'percentage';
      const mlUpfrontPercent = roundCurrency(clamp(Number(mlResult?.predictions?.upfrontPercent), 0, 100));
      const mlLaborRatio = Number(mlResult?.predictions?.laborRatio);

      finalLaborHand = mlLaborHand;
      if (Number.isFinite(mlLaborRatio) && mlLaborRatio > 0) {
        finalLaborRatio = mlLaborRatio;
      }

      finalPaymentType = mlPaymentType;
      finalUpfrontPercent = mlUpfrontPercent;
      finalTotalEstimated = roundCurrency(finalLaborHand + materialsAmount);
      finalUpfrontFixedAmount = roundCurrency((finalTotalEstimated * finalUpfrontPercent) / 100);
      finalUpfrontValue = finalPaymentType === 'percentage' ? finalUpfrontPercent : finalUpfrontFixedAmount;

      const mlConfidence = clamp(Number(mlResult?.confidence), 0.35, 0.99);
      finalLaborConfidence = roundCurrency(clamp((laborConfidence + mlConfidence) / 2 + 0.1, 0.45, 0.99));
      finalPaymentConfidence = roundCurrency(clamp((paymentConfidence + mlConfidence) / 2 + 0.1, 0.45, 0.99));

      inference.source = 'ml-rag';
      inference.model = mlResult.model;
      inference.method = mlResult.method;
      inference.confidence = roundCurrency(mlConfidence);
      inference.historyCount = Number(mlResult.historyCount) || 0;
      inference.neighborsUsed = Number(mlResult.neighborsUsed) || 0;
      inference.averageSimilarity = toUiSimilarity(mlResult.averageSimilarity);
      inference.neighbors = Array.isArray(mlResult.neighbors)
        ? mlResult.neighbors.map((item) => ({
            quoteId: String(item.quoteId || ''),
            quoteNumber: String(item.quoteNumber || ''),
            similarity: toUiSimilarity(item.similarity),
            laborHand: roundCurrency(Number(item.laborHand) || 0),
            amount: roundCurrency(Number(item.amount) || 0),
            upfrontPercent: roundCurrency(clamp(Number(item.upfrontPercent), 0, 100)),
            paymentMode: item.paymentMode === 'fixed' ? 'fixed' : 'percentage',
            projectTitle: String(item.projectTitle || 'Untitled project'),
          }))
        : [];

      assumptions.push('ML retrieval uses nearest approved quotes from the same artisan history.');

      if (Number(inference.averageSimilarity) < 52) {
        warnings.push('ML similarity is moderate for this project; review suggested values before sending the quote.');
      }
    } else {
      inference.source = 'heuristic-fallback';
      inference.model = 'Xenova/all-MiniLM-L6-v2';
      inference.method = 'embedding-rag-nearest-neighbors';
      inference.confidence = roundCurrency(baseConfidence);
      inference.historyCount = Number(mlResult?.historyCount) || 0;
      inference.neighborsUsed = Number(mlResult?.neighborsUsed) || 0;
      inference.fallbackReason = resolveFallbackReasonLabel(mlResult?.reason, mlResult?.historyCount, mlResult?.requiredHistory);
      warnings.push(inference.fallbackReason);
    }
  } catch (_mlError) {
    inference.source = 'heuristic-fallback';
    inference.model = 'Xenova/all-MiniLM-L6-v2';
    inference.method = 'embedding-rag-nearest-neighbors';
    inference.confidence = roundCurrency(baseConfidence);
    inference.fallbackReason = 'ML service is temporarily unavailable; heuristic fallback was used.';
    warnings.push('ML service is temporarily unavailable; heuristic fallback was used.');
  }

  const laborReasoning = inference.source === 'ml-rag'
    ? [
        `ML model ${inference.model} compared this project with ${inference.neighborsUsed} similar approved quote(s).`,
        `Average similarity: ${roundCurrency(inference.averageSimilarity || 0)}%. Predicted labor ratio: ${roundCurrency(finalLaborRatio)}.`,
        `Estimated labor: ${finalLaborHand.toLocaleString()} TND for total estimate ${finalTotalEstimated.toLocaleString()} TND.`,
      ]
    : [
        `Labor ratio ${roundCurrency(finalLaborRatio)} combines technical risk (${riskTechnical}/100) and delay risk (${riskDelay}/100).`,
        `Project priority "${priority}" and timeline (${daysToDeadline} day(s) to deadline) adjust the final estimate.`,
        `Estimated labor: ${finalLaborHand.toLocaleString()} TND for a total estimated quote of ${finalTotalEstimated.toLocaleString()} TND.`,
      ];

  const paymentReasoning = inference.source === 'ml-rag'
    ? [
        `Payment mode inferred from weighted nearest-neighbor vote (${inference.neighborsUsed} approved quote(s)).`,
        `ML confidence ${(inference.confidence * 100).toFixed(0)}% with similarity average ${roundCurrency(inference.averageSimilarity || 0)}%.`,
        finalPaymentType === 'percentage'
          ? 'Percentage mode is preferred for stronger cash-flow protection on similar projects.'
          : 'Fixed mode is preferred for similar projects with stable payment patterns.',
      ]
    : paymentType === 'percentage'
      ? [
          `Percentage mode was selected because risk is ${overallRisk}/100 and total estimate is ${finalTotalEstimated.toLocaleString()} TND.`,
          'Percentage upfront protects cash flow when execution or market volatility is elevated.',
        ]
      : [
          `Fixed mode was selected because risk is controlled (${overallRisk}/100) and estimate remains moderate (${finalTotalEstimated.toLocaleString()} TND).`,
          'Fixed upfront keeps terms simple for low-to-medium volatility projects.',
        ];

  return {
    generatedAt: new Date().toISOString(),
    projectSnapshot: {
      projectId: String(project?._id || ''),
      title: String(project?.title || ''),
      location: String(project?.location || ''),
      priority,
      durationDays,
      daysToDeadline,
      taskCount,
      completionRatio: roundCurrency(completionRatio * 100),
      materialsCount: materialItems.length,
      materialsAmount,
      totalEstimated: finalTotalEstimated,
    },
    inference,
    recommendations: {
      description: {
        value: description,
        confidence: roundCurrency(descriptionConfidence),
        reasoning: [
          'Scope uses the project description and available task context.',
          `Material section summarizes ${materialItems.length} priced item(s) already attached to the project.`,
          `Validity clause adapts to a ${riskLevel} overall risk level (${overallRisk}/100).`,
        ],
      },
      laborHand: {
        value: finalLaborHand,
        ratioApplied: roundCurrency(finalLaborRatio),
        confidence: roundCurrency(finalLaborConfidence),
        reasoning: laborReasoning,
      },
      paymentType: {
        value: finalPaymentType,
        confidence: roundCurrency(finalPaymentConfidence),
        reasoning: paymentReasoning,
      },
      upfront: {
        value: finalUpfrontValue,
        mode: finalPaymentType,
        percent: finalUpfrontPercent,
        fixedAmount: finalUpfrontFixedAmount,
        confidence: roundCurrency(finalPaymentConfidence),
        risk: {
          overall: overallRisk,
          level: riskLevel,
          client: roundCurrency(riskClient),
          delay: roundCurrency(riskDelay),
          technical: roundCurrency(riskTechnical),
          price: roundCurrency(riskPrice),
        },
        reasoning: inference.source === 'ml-rag'
          ? [
              `ML weighted recommendation: ${formatPercent(finalUpfrontPercent)} (${finalUpfrontFixedAmount.toLocaleString()} TND), derived from nearest approved quotes.`,
              `Risk reference remains ${overallRisk}/100 (client 35%, delay 25%, technical 20%, price 20%).`,
              'The recommendation is automatically clamped to safe business limits before submission.',
            ]
          : [
              `Weighted risk score: ${overallRisk}/100 (client 35%, delay 25%, technical 20%, price 20%).`,
              `Recommended upfront: ${formatPercent(finalUpfrontPercent)} (${finalUpfrontFixedAmount.toLocaleString()} TND).`,
              'The recommendation is automatically clamped to safe business limits before submission.',
            ],
      },
      validUntil: {
        value: validUntil,
        validityDays,
        confidence: roundCurrency(clamp(baseConfidence + 0.02, 0.4, 0.95)),
        reasoning: [
          `Validity period set to ${validityDays} day(s) based on ${riskLevel} risk level and timeline pressure.`,
          'Shorter validity protects the quote from material price and schedule volatility.',
        ],
      },
    },
    warnings,
    assumptions,
  };
};

module.exports = {
  generateQuoteAIDraft,
};
