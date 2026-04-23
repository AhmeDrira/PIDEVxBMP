import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Messages from '@/components/common/Messages';
import { server } from '../../setup/mswServer';
import { artisanUser } from '../../fixtures/user.fixtures';

vi.mock('@/components/expert/ViewArtisanProfile', () => ({
  default: () => <div>view-artisan-profile-mock</div>,
}));

vi.mock('@/components/common/VoiceMessage', () => ({
  default: () => <div data-testid="voice-message-mock" />,
}));

vi.mock('@/components/common/VoiceRecorder', () => ({
  default: () => <div data-testid="voice-recorder-mock" />,
}));

vi.mock('@/components/common/CallButton', () => ({
  default: () => <div data-testid="call-button-mock" />,
}));

vi.mock('@/components/common/IncomingCallModal', () => ({
  default: () => <div data-testid="incoming-call-modal-mock" />,
}));

vi.mock('@/components/common/CallingModal', () => ({
  default: () => <div data-testid="calling-modal-mock" />,
}));

vi.mock('@/components/common/VideoCall', () => ({
  default: () => <div data-testid="video-call-mock" />,
}));

vi.mock('@/components/common/AudioCall', () => ({
  default: () => <div data-testid="audio-call-mock" />,
}));

describe('Messages component', () => {
  beforeEach(() => {
    localStorage.setItem('token', artisanUser.token);
    localStorage.setItem('user', JSON.stringify(artisanUser));
    localStorage.setItem('selectedConversationId', 'conv-1');
  });

  it('should render conversations, show loading state, and send a message', async () => {
    // Arrange
    server.use(
      http.post('*/api/messages', () =>
        HttpResponse.json({
          _id: 'msg-posted-test-1',
          sender: {
            _id: artisanUser._id,
            firstName: artisanUser.firstName,
            lastName: artisanUser.lastName,
          },
          content: 'Message from test',
          createdAt: new Date().toISOString(),
          attachments: [],
          reactions: [],
        })
      )
    );

    const user = userEvent.setup();

    // Act
    render(<Messages />);

    // Assert
    expect(screen.getByText(/chargement des conversations/i)).toBeInTheDocument();
    expect((await screen.findAllByText('Eya Expert')).length).toBeGreaterThan(0);

    const input = (await screen.findAllByPlaceholderText(/ecrire un message/i))[0];
    await user.type(input, 'Message from test{Enter}');

    expect(await screen.findByText('Message from test')).toBeInTheDocument();
  });

  it('should display an error when sending a message fails', async () => {
    // Arrange
    server.use(
      http.post('*/api/messages', () =>
        HttpResponse.json({ message: 'Unable to send message.' }, { status: 500 })
      ),
      http.get('*/api/messages', () =>
        HttpResponse.json([
          {
            _id: 'msg-1',
            sender: {
              _id: 'user-expert-1',
              firstName: 'Eya',
              lastName: 'Expert',
            },
            content: 'Welcome to the chat',
            createdAt: new Date().toISOString(),
            attachments: [],
            reactions: [],
          },
        ])
      ),
      http.post('*/api/messages/voice', () =>
        HttpResponse.json({ message: 'Unable to send message.' }, { status: 500 })
      )
    );
    const user = userEvent.setup();

    // Act
    render(<Messages />);

    const input = (await screen.findAllByPlaceholderText(/ecrire un message/i))[0];
    await user.click(input);
    await user.type(input, 'This will fail{Enter}');

    // Assert
    expect(
      await screen.findByText(/unable to send message|request failed|network error|500/i)
    ).toBeInTheDocument();
  });
});
