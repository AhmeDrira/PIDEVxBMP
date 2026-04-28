jest.mock('../../../models/Conversation', () => ({
  findById: jest.fn(),
}));

const Conversation = require('../../../models/Conversation');
const setupCallSocket = require('../../../socket/callSocket');

const createSocketHarness = () => {
  const handlers = {};
  const mockEmit = jest.fn();

  const socket = {
    user: { id: 'u1' },
    rooms: new Set(['socket-1']),
    on: jest.fn((event, handler) => {
      handlers[event] = handler;
    }),
    join: jest.fn(),
    to: jest.fn(() => ({ emit: mockEmit })),
  };

  const io = {
    to: jest.fn(() => ({ emit: jest.fn() })),
    in: jest.fn(() => ({ socketsLeave: jest.fn() })),
  };

  return { io, socket, handlers, mockEmit };
};

describe('callSocket', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('call:start -> returns error when conversation is not found', async () => {
    Conversation.findById.mockResolvedValue(null);

    const { io, socket, handlers } = createSocketHarness();
    setupCallSocket(io, socket);

    const callback = jest.fn();
    await handlers['call:start']({ conversationId: 'c1', type: 'audio' }, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'Conversation not found' });
  });

  test('call:start -> returns unauthorized when user is not in participants', async () => {
    Conversation.findById.mockResolvedValue({
      participants: ['u2', 'u3'],
    });

    const { io, socket, handlers } = createSocketHarness();
    setupCallSocket(io, socket);

    const callback = jest.fn();
    await handlers['call:start']({ conversationId: 'c2', type: 'video' }, callback);

    expect(callback).toHaveBeenCalledWith({ error: 'Unauthorized' });
  });

  test('call:offer -> relays offer to call room', () => {
    const { io, socket, handlers, mockEmit } = createSocketHarness();
    setupCallSocket(io, socket);

    handlers['call:offer']({ conversationId: 'c3', offer: { sdp: 'abc' } });

    expect(socket.to).toHaveBeenCalledWith('call:c3');
    expect(mockEmit).toHaveBeenCalledWith('call:offer', { offer: { sdp: 'abc' } });
  });
});
