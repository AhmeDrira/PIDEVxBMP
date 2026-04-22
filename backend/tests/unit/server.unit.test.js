const mockApp = {};
const mockListen = jest.fn((port, callback) => callback());
const mockServer = { listen: mockListen };
const mockCreateServer = jest.fn(() => mockServer);
const mockInitSocket = jest.fn();
const mockInitSubscriptionExpirationJob = jest.fn();

jest.mock('../../app', () => mockApp);
jest.mock('http', () => ({
  createServer: mockCreateServer,
}));
jest.mock('../../socket', () => ({
  initSocket: mockInitSocket,
}));
jest.mock('../../jobs/subscriptionExpirationJob', () => ({
  initSubscriptionExpirationJob: mockInitSubscriptionExpirationJob,
}));

describe('server bootstrap', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.PORT;
  });

  test('starts server on default port and initializes socket + cron job', () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

    require('../../server');

    expect(mockCreateServer).toHaveBeenCalledWith(mockApp);
    expect(mockInitSocket).toHaveBeenCalledWith(mockServer);
    expect(mockListen).toHaveBeenCalledWith(5000, expect.any(Function));
    expect(mockInitSubscriptionExpirationJob).toHaveBeenCalledTimes(1);
    expect(mockConsoleLog).toHaveBeenCalledWith('Server running on port 5000');

    mockConsoleLog.mockRestore();
  });

  test('uses PORT env when provided', () => {
    process.env.PORT = '7001';

    require('../../server');

    expect(mockListen).toHaveBeenCalledWith('7001', expect.any(Function));
  });
});
