const mockIo = {
  use: jest.fn(),
  on: jest.fn(),
};

const mockServer = jest.fn(() => mockIo);

jest.mock('socket.io', () => ({
  Server: mockServer,
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../../socket/callSocket', () => jest.fn());

const jwt = require('jsonwebtoken');
const socketModule = require('../../../socket');

describe('socket index coverage additions', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockIo.use.mockClear();
    mockIo.on.mockClear();
    mockServer.mockClear();
    jwt.verify.mockReset();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  test('initSocket auth middleware -> returns misconfiguration when JWT_SECRET is missing', () => {
    delete process.env.JWT_SECRET;

    socketModule.initSocket({});
    const authMiddleware = mockIo.use.mock.calls[0][0];

    const socket = { handshake: { auth: { token: 'jwt-token' } } };
    const next = jest.fn();

    authMiddleware(socket, next);

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(next.mock.calls[0][0].message).toMatch(/Server misconfiguration/i);
  });
});
