const aiService = require('../../../services/aiService');

describe('aiService', () => {
  beforeEach(() => {
    aiService.__resetForTests();
  });

  test('extractProjectData -> throws on invalid text input', async () => {
    await expect(aiService.extractProjectData('')).rejects.toThrow(/vide ou invalide/i);
    await expect(aiService.extractProjectData(null)).rejects.toThrow();
  });

  test('extractProjectData -> returns raw answers and scores (nominal path)', async () => {
    const pipeline = jest.fn(async (question, context) => {
      if (/project name/i.test(question)) return { answer: 'Projet Villa', score: 0.91 };
      if (/location or city/i.test(question)) return { answer: 'Sousse', score: 0.82 };
      if (/description or task/i.test(question)) return { answer: 'Peinture complete', score: 0.74 };
      return { answer: '2026-05-20', score: 0.65 };
    });

    aiService.__setPipelineForTests(pipeline);

    const result = await aiService.extractProjectData('Renovation villa a Sousse avec peinture interieure.');

    expect(result.title.answer).toBe('Projet Villa');
    expect(result.location.answer).toBe('Sousse');
    expect(result.description.answer).toMatch(/Peinture/i);
    expect(result.date.answer).toBe('2026-05-20');
    expect(pipeline).toHaveBeenCalledTimes(4);
  });

  test('extractProjectData -> keeps processing when one pipeline call fails', async () => {
    const pipeline = jest.fn(async (question) => {
      if (/location/i.test(question)) {
        throw new Error('provider timeout');
      }
      return { answer: 'ok', score: 0.5 };
    });

    aiService.__setPipelineForTests(pipeline);

    const result = await aiService.extractProjectData('Text describing a construction project.');

    expect(result.location.answer).toBeNull();
    expect(result.location.score).toBe(0);
    expect(result.title.answer).toBe('ok');
  });

  test('warmUp -> resolves without throwing when pipeline is already injected', async () => {
    aiService.__setPipelineForTests(jest.fn());

    await expect(aiService.warmUp()).resolves.toBeUndefined();
  });
});
