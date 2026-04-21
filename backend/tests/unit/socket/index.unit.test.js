const mockIo = {
  use: jest.fn(),
  on: jest.fn(),
};

process.env.JWT_SECRET = 'test-secret-key-for-socket-tests';

const mockServer = jest.fn(() => mockIo);

jest.mock('socket.io', () => ({
  Server: mockServer,
}));

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../../socket/callSocket', () => jest.fn());

const jwt = require('jsonwebtoken');
const setupCallSocket = require('../../../socket/callSocket');
const socketModule = require('../../../socket');

describe('socket index', () => {
  beforeEach(() => {
    mockIo.use.mockClear();
    mockIo.on.mockClear();
    mockServer.mockClear();
    jwt.verify.mockReset();
    setupCallSocket.mockClear();
  });

  test('initSocket -> configures auth middleware and connection handler', () => {
    const io = socketModule.initSocket({});

    expect(io).toBe(mockIo);
    expect(mockServer).toHaveBeenCalled();
    expect(mockIo.use).toHaveBeenCalled();
    expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));

    const authMiddleware = mockIo.use.mock.calls[0][0];

    const noTokenSocket = { handshake: { auth: {} } };
    const nextNoToken = jest.fn();
    authMiddleware(noTokenSocket, nextNoToken);
    expect(nextNoToken.mock.calls[0][0]).toBeInstanceOf(Error);

    jwt.verify.mockReturnValue({ id: 'u1' });
    const validSocket = { handshake: { auth: { token: 'jwt-token' } } };
    const nextValid = jest.fn();
    authMiddleware(validSocket, nextValid);

    expect(nextValid).toHaveBeenCalledWith();
    expect(validSocket.user.id).toBe('u1');

    const connectionHandler = mockIo.on.mock.calls.find(([event]) => event === 'connection')[1];
    const connectedSocket = {
      user: { id: 'u1' },
      id: 'socket-1',
      join: jest.fn(),
      on: jest.fn(),
    };

    connectionHandler(connectedSocket);

    expect(connectedSocket.join).toHaveBeenCalledWith('user:u1');
    expect(setupCallSocket).toHaveBeenCalledWith(mockIo, connectedSocket);
    expect(socketModule.getIo()).toBe(mockIo);
  });

  test('getIo -> throws when socket layer is not initialized', () => {
    jest.resetModules();

    jest.isolateModules(() => {
      const freshModule = require('../../../socket');
      expect(() => freshModule.getIo()).toThrow(/not initialized/i);
    });
  });
});
