process.env.JWT_SECRET = 'test-secret-key-for-socket-tests';

const http = require('http');
const jwt = require('jsonwebtoken');
const clientIo = require('socket.io-client');

describe('Socket Index - Tests de couverture', () => {
  let io;
  let socketModule;
  let httpServer;
  let port;
  let clientSocket;
  let serverSocket;

  beforeAll(async () => {
    httpServer = http.createServer();

    socketModule = require('../../../socket');
    socketModule.initSocket(httpServer);
    io = socketModule.getIo();

    await new Promise((resolve) => {
      httpServer.listen(() => {
        port = httpServer.address().port;
        resolve();
      });
    });

    const token = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET);

    const serverConnected = new Promise((resolve) => {
      io.once('connection', (socket) => {
        serverSocket = socket;
        resolve();
      });
    });

    clientSocket = await new Promise((resolve, reject) => {
      const client = clientIo(`http://localhost:${port}`, {
        auth: { token },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });

      client.once('connect', () => resolve(client));
      client.once('connect_error', reject);
    });

    await serverConnected;
  });

  afterAll(async () => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }

    if (io) {
      io.close();
    }

    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(resolve);
      });
    }
  });

  test('should authenticate socket with valid token', async () => {
    const data = await new Promise((resolve) => {
      serverSocket.once('test-event', resolve);
      clientSocket.emit('test-event', { data: 'test' });
    });

    expect(data.data).toBe('test');
  });

  test('should handle user joining personal room', () => {
    expect(clientSocket.connected).toBe(true);
    expect(serverSocket.rooms.has('user:user123')).toBe(true);
  });

  test('should handle connection without token', async () => {
    const error = await new Promise((resolve) => {
      const clientNoToken = clientIo(`http://localhost:${port}`, {
        auth: {},
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });

      clientNoToken.once('connect_error', (err) => {
        clientNoToken.disconnect();
        resolve(err);
      });

      clientNoToken.once('connect', () => {
        clientNoToken.disconnect();
        resolve(new Error('Expected connection to fail without token'));
      });
    });

    expect(error.message).toContain('Authentication');
  });

  test('should handle disconnection', async () => {
    const reason = await new Promise((resolve) => {
      serverSocket.once('disconnect', resolve);
      clientSocket.disconnect();
    });

    expect(reason).toBeDefined();
  });
});
