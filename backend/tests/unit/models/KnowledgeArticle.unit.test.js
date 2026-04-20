const KnowledgeArticle = require('../../../models/KnowledgeArticle');

describe('KnowledgeArticle model', () => {
  test('validateSync -> fails on missing required fields', () => {
    const doc = new KnowledgeArticle({});
    const err = doc.validateSync();

    expect(err.errors.title).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.summary).toBeDefined();
    expect(err.errors.content).toBeDefined();
  });

  test('defaults -> status, authorName and counters are initialized', () => {
    const doc = new KnowledgeArticle({
      title: 'Guide',
      category: 'Beton',
      summary: 'Short',
      content: 'Long text',
    });

    const err = doc.validateSync();

    expect(err).toBeUndefined();
    expect(doc.status).toBe('published');
    expect(doc.authorName).toBe('BMP Editorial Team');
    expect(doc.views).toBe(0);
    expect(doc.likes).toBe(0);
  });

  test('validateSync -> rejects invalid status enum', () => {
    const doc = new KnowledgeArticle({
      title: 'Guide',
      category: 'Beton',
      summary: 'Short',
      content: 'Long text',
      status: 'archived',
    });

    const err = doc.validateSync();

    expect(err.errors.status).toBeDefined();
  });
});
