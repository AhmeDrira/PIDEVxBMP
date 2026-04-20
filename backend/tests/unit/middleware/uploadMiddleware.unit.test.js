describe('uploadMiddleware', () => {
  const setupModule = ({ dirExists = true } = {}) => {
    jest.resetModules();

    const fsMock = {
      existsSync: jest.fn(() => dirExists),
      mkdirSync: jest.fn(),
    };

    const multerFactory = jest.fn((options) => ({
      __options: options,
      storage: options.storage,
      fileFilter: options.fileFilter,
      limits: options.limits,
    }));
    multerFactory.diskStorage = jest.fn((cfg) => cfg);

    jest.doMock('fs', () => fsMock);
    jest.doMock('multer', () => multerFactory);

    const upload = require('../../../middleware/uploadMiddleware');
    const multer = require('multer');

    return { upload, multer, fsMock };
  };

  test('creates uploads directory when missing', () => {
    const { fsMock } = setupModule({ dirExists: false });

    expect(fsMock.existsSync).toHaveBeenCalledWith('./uploads');
    expect(fsMock.mkdirSync).toHaveBeenCalledWith('./uploads');
  });

  test('accepts allowed image/pdf files in fileFilter', () => {
    const { multer } = setupModule();
    const options = multer.mock.calls[0][0];

    const cb = jest.fn();
    options.fileFilter(
      {},
      { originalname: 'document.pdf', mimetype: 'application/pdf' },
      cb
    );

    expect(cb).toHaveBeenCalledWith(null, true);
  });

  test('rejects unsupported file types', () => {
    const { multer } = setupModule();
    const options = multer.mock.calls[0][0];

    const cb = jest.fn();
    options.fileFilter(
      {},
      { originalname: 'script.exe', mimetype: 'application/octet-stream' },
      cb
    );

    const [errorArg] = cb.mock.calls[0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toMatch(/formats/i);
  });

  test('uses expected upload size limit', () => {
    const { multer } = setupModule();
    const options = multer.mock.calls[0][0];

    expect(options.limits.fileSize).toBe(5 * 1024 * 1024);
  });
});
