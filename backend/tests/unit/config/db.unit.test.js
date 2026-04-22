jest.mock('mongoose', () => ({
  connect: jest.fn(),
}));

const mongoose = require('mongoose');
const connectDB = require('../../../config/db');

describe('config/db', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/testdb';
  });

  test('connects to MongoDB and logs host on success', async () => {
    const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mongoose.connect.mockResolvedValue({
      connection: { host: '127.0.0.1' },
    });

    await connectDB();

    expect(mongoose.connect).toHaveBeenCalledWith('mongodb://127.0.0.1:27017/testdb');
    expect(mockConsoleLog).toHaveBeenCalledWith('MongoDB Connected: 127.0.0.1');

    mockConsoleLog.mockRestore();
  });

  test('logs error and exits process on failure', async () => {
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
    mongoose.connect.mockRejectedValue(new Error('connection refused'));

    await connectDB();

    expect(mockConsoleError).toHaveBeenCalledWith('Error: connection refused');
    expect(mockExit).toHaveBeenCalledWith(1);

    mockConsoleError.mockRestore();
    mockExit.mockRestore();
  });
});
