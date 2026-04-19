const buildRecommendationProduct = (overrides = {}) => ({
  _id: 'prod-001',
  name: 'Beton C25 sac 35kg',
  category: 'Beton',
  description: 'Beton resistant pour fondation exterieure',
  price: 32,
  stock: 120,
  status: 'active',
  rating: 4.4,
  manufacturer: 'mfr-001',
  ...overrides,
});

module.exports = {
  buildRecommendationProduct,
};
