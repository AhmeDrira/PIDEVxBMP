jest.mock('axios', () => ({
  get: jest.fn(),
}));

jest.mock('pdf-parse', () => jest.fn(async () => ({
  text: 'NF EN 206 Beton structurel CE 1234 resistance 30 MPa dimensions 200x100 mm usage exterieur',
})));

jest.mock('../../../models/TechSheetCache', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const axios = require('axios');
const TechSheetCache = require('../../../models/TechSheetCache');
const analyzer = require('../../../services/TechSheetAnalyzer');

describe('TechSheetAnalyzer', () => {
  beforeEach(() => {
    TechSheetCache.findOne.mockReset();
    TechSheetCache.findOneAndUpdate.mockReset();
    axios.get.mockReset();
  });

  test('analyzePdf -> extracts profile from remote PDF content (nominal)', async () => {
    axios.get.mockResolvedValue({ data: Buffer.from('fake-pdf-bytes') });

    const result = await analyzer.analyzePdf('https://cdn.example.com/tech-sheet.pdf');

    expect(result.profile.norms.length).toBeGreaterThan(0);
    expect(result.profile.materials.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
  });

  test('getOrAnalyze -> returns cached record when url is unchanged', async () => {
    TechSheetCache.findOne.mockResolvedValue({
      techSheetUrl: 'https://cdn.example.com/ts.pdf',
      success: true,
      profile: { norms: ['NF EN'], certifications: [], resistance: [], dimensions: [], environment: [], safety: [], materials: [], keywords: [] },
      confidence: 0.72,
      extractedText: 'cached',
    });

    const result = await analyzer.getOrAnalyze({ _id: 'p1', techSheetUrl: 'https://cdn.example.com/ts.pdf' });

    expect(result.fromCache).toBe(true);
    expect(result.success).toBe(true);
  });

  test('getOrAnalyze -> handles missing techSheetUrl', async () => {
    TechSheetCache.findOne.mockResolvedValue(null);

    const result = await analyzer.getOrAnalyze({ _id: 'p2', techSheetUrl: '' });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/No tech sheet URL provided/i);
    expect(TechSheetCache.findOneAndUpdate).toHaveBeenCalled();
  });

  test('getOrAnalyze -> stores failure when dependency fails', async () => {
    TechSheetCache.findOne.mockResolvedValue(null);
    axios.get.mockRejectedValue(new Error('network down'));

    const result = await analyzer.getOrAnalyze({ _id: 'p3', techSheetUrl: 'https://cdn.example.com/bad.pdf' });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/network down/i);
    expect(TechSheetCache.findOneAndUpdate).toHaveBeenCalled();
  });
});
