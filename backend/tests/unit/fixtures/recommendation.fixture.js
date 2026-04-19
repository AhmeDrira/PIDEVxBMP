const buildTechProfile = (overrides = {}) => ({
  norms: ['NF EN 206'],
  certifications: ['CE'],
  safety: ['A2'],
  resistance: ['30 MPa'],
  environment: ['exterieur'],
  materials: ['beton'],
  keywords: ['fondation'],
  ...overrides,
});

const buildSemanticAnalysis = (overrides = {}) => ({
  matchStrength: 'strong',
  matchCount: 4,
  bonus: 8,
  penalty: 0,
  ...overrides,
});

module.exports = {
  buildTechProfile,
  buildSemanticAnalysis,
};
