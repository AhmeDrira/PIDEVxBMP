/**
 * Tests for the small Call* components family:
 *   CallButton, CallControls, CallingModal, IncomingCallModal,
 *   AudioCall, VideoCall, CallWindow.
 *
 * These components are mostly presentational; we exercise their main branches
 * (rendering, click handlers, conditional rendering) without spinning up a
 * full WebRTC stack.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// jsdom does not implement HTMLMediaElement.play / pause / srcObject — provide
// minimal stubs so the components' useEffect side-effects don't crash.
beforeAll(() => {
  if (!(HTMLMediaElement.prototype as any).__playStubbed) {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      writable: true,
      value: vi.fn(() => Promise.resolve()),
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    (HTMLMediaElement.prototype as any).__playStubbed = true;
  }
});

import CallButton from '@/components/common/CallButton';
import CallControls from '@/components/common/CallControls';
import CallingModal from '@/components/common/CallingModal';
import IncomingCallModal from '@/components/common/IncomingCallModal';
import AudioCall from '@/components/common/AudioCall';
import VideoCall from '@/components/common/VideoCall';
import CallWindow from '@/components/common/CallWindow';
import type { CallState } from '@/hooks/useCall';

const baseCallState: CallState = {
  status: 'idle',
  type: null,
  remoteUser: null,
  conversationId: null,
  startTime: null,
  duration: 0,
  error: null,
  isCaller: false,
};

const remoteUser = { id: 'r', name: 'Alice', avatar: 'A' };

const mediaStream = (kind: 'audio' | 'video' | 'both' = 'audio') => {
  const audioTrack = { enabled: true, stop: vi.fn(), kind: 'audio' } as any;
  const videoTrack = { enabled: true, stop: vi.fn(), kind: 'video' } as any;
  return {
    id: `s-${kind}`,
    getTracks: () => (kind === 'audio' ? [audioTrack] : kind === 'video' ? [videoTrack] : [audioTrack, videoTrack]),
    getAudioTracks: () => (kind === 'video' ? [] : [audioTrack]),
    getVideoTracks: () => (kind === 'audio' ? [] : [videoTrack]),
  } as unknown as MediaStream;
};

// ---------- CallButton ------------------------------------------------------

describe('CallButton', () => {
  it('renders both buttons and triggers their callbacks', async () => {
    const audio = vi.fn();
    const video = vi.fn();
    render(<CallButton onAudioCall={audio} onVideoCall={video} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);

    await userEvent.setup().click(buttons[0]);
    await userEvent.setup().click(buttons[1]);
    expect(audio).toHaveBeenCalledTimes(1);
    expect(video).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons when disabled is true', () => {
    render(<CallButton onAudioCall={vi.fn()} onVideoCall={vi.fn()} disabled />);
    screen.getAllByRole('button').forEach((b) => expect(b).toBeDisabled());
  });
});

// ---------- CallControls ----------------------------------------------------

describe('CallControls', () => {
  it('renders mic + hangup buttons (audio call) and triggers their handlers', async () => {
    const toggleMic = vi.fn();
    const end = vi.fn();
    render(
      <CallControls
        isMicrophoneEnabled
        isCameraEnabled={false}
        toggleMicrophone={toggleMic}
        toggleCamera={vi.fn()}
        endCall={end}
        isVideoCall={false}
      />
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    const user = userEvent.setup();
    await user.click(buttons[0]); // mic
    await user.click(buttons[1]); // hangup
    expect(toggleMic).toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
  });

  it('renders the camera button only when isVideoCall is true', () => {
    const { rerender } = render(
      <CallControls
        isMicrophoneEnabled
        isCameraEnabled
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
        isVideoCall
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);

    rerender(
      <CallControls
        isMicrophoneEnabled
        isCameraEnabled
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
        isVideoCall={false}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the disabled-mic icon when isMicrophoneEnabled is false', () => {
    const { container } = render(
      <CallControls
        isMicrophoneEnabled={false}
        isCameraEnabled
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
        isVideoCall
      />
    );
    // The mic-off button gets a destructive-red background style applied
    const micButton = container.querySelectorAll('button')[0] as HTMLButtonElement;
    expect(micButton.style.backgroundColor).toMatch(/rgb\(239, 68, 68\)/);
  });

  it('shows the disabled-camera icon when isCameraEnabled is false', () => {
    const { container } = render(
      <CallControls
        isMicrophoneEnabled
        isCameraEnabled={false}
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
        isVideoCall
      />
    );
    const camButton = container.querySelectorAll('button')[2] as HTMLButtonElement;
    expect(camButton.style.backgroundColor).toMatch(/rgb\(239, 68, 68\)/);
  });
});

// ---------- CallingModal ----------------------------------------------------

describe('CallingModal', () => {
  it('renders nothing when status is not "calling"', () => {
    const { container } = render(<CallingModal callState={baseCallState} onCancel={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal and calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <CallingModal
        callState={{
          ...baseCallState,
          status: 'calling',
          type: 'audio',
          remoteUser,
          conversationId: 'c1',
          isCaller: true,
        }}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText(/Appel audio en cours/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /annuler/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows the video label when type is "video"', () => {
    render(
      <CallingModal
        callState={{
          ...baseCallState,
          status: 'calling',
          type: 'video',
          remoteUser,
        }}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText(/Appel vidéo en cours/i)).toBeInTheDocument();
  });
});

// ---------- IncomingCallModal -----------------------------------------------

describe('IncomingCallModal', () => {
  it('renders nothing when status is not "ringing"', () => {
    const { container } = render(
      <IncomingCallModal callState={baseCallState} onAccept={vi.fn()} onReject={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders accept/reject buttons that trigger their handlers', async () => {
    const accept = vi.fn();
    const reject = vi.fn();
    const user = userEvent.setup();
    render(
      <IncomingCallModal
        callState={{
          ...baseCallState,
          status: 'ringing',
          type: 'audio',
          remoteUser,
          conversationId: 'c2',
        }}
        onAccept={accept}
        onReject={reject}
      />
    );
    await user.click(screen.getByRole('button', { name: /refuser/i }));
    await user.click(screen.getByRole('button', { name: /accepter/i }));
    expect(reject).toHaveBeenCalled();
    expect(accept).toHaveBeenCalled();
  });

  it('shows the video label when call type is "video"', () => {
    render(
      <IncomingCallModal
        callState={{
          ...baseCallState,
          status: 'ringing',
          type: 'video',
          remoteUser,
        }}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText(/Appel vidéo entrant/i)).toBeInTheDocument();
  });

  it('falls back to "Utilisateur" when remoteUser is missing', () => {
    render(
      <IncomingCallModal
        callState={{ ...baseCallState, status: 'ringing', type: 'audio' }}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />
    );
    expect(screen.getByText('Utilisateur')).toBeInTheDocument();
  });
});

// ---------- AudioCall -------------------------------------------------------

describe('AudioCall', () => {
  it('renders the remote user, formatted duration, and the audio element', () => {
    const { container } = render(
      <AudioCall
        callState={{
          ...baseCallState,
          status: 'in-call',
          type: 'audio',
          remoteUser,
          conversationId: 'c3',
          duration: 65,
        }}
        remoteStream={mediaStream('audio')}
        isMicrophoneEnabled
        toggleMicrophone={vi.fn()}
        endCall={vi.fn()}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('01:05')).toBeInTheDocument();
    // hidden audio element used to play the remote stream
    expect(container.querySelector('audio')).toBeInTheDocument();
  });

  it('renders fallback "Utilisateur" + "?" avatar when remoteUser is missing', () => {
    render(
      <AudioCall
        callState={{ ...baseCallState, status: 'in-call', type: 'audio', duration: 0 }}
        remoteStream={null}
        isMicrophoneEnabled
        toggleMicrophone={vi.fn()}
        endCall={vi.fn()}
      />
    );
    expect(screen.getByText('Utilisateur')).toBeInTheDocument();
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
  });
});

// ---------- VideoCall -------------------------------------------------------

describe('VideoCall', () => {
  it('shows "Connexion en cours" when there is no remote stream and renders the local PiP block', () => {
    const { container } = render(
      <VideoCall
        callState={{
          ...baseCallState,
          status: 'in-call',
          type: 'video',
          remoteUser,
          duration: 5,
        }}
        localStream={mediaStream('video')}
        remoteStream={null}
        isMicrophoneEnabled
        isCameraEnabled
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
      />
    );
    expect(screen.getByText(/Connexion en cours/i)).toBeInTheDocument();
    // The local PiP <video> is always rendered; the remote one is conditional
    expect(container.querySelectorAll('video').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/VideoCall Component - Local: OK \| Remote: NO/)).toBeInTheDocument();
  });

  it('renders both local + remote videos when streams are available', () => {
    const { container } = render(
      <VideoCall
        callState={{
          ...baseCallState,
          status: 'in-call',
          type: 'video',
          remoteUser,
          duration: 130,
        }}
        localStream={mediaStream('video')}
        remoteStream={mediaStream('video')}
        isMicrophoneEnabled
        isCameraEnabled
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
      />
    );
    expect(container.querySelectorAll('video').length).toBe(2);
    expect(screen.getByText('02:10')).toBeInTheDocument();
  });

  it('shows the "camera off" placeholder when isCameraEnabled is false', () => {
    render(
      <VideoCall
        callState={{
          ...baseCallState,
          status: 'in-call',
          type: 'video',
          remoteUser,
        }}
        localStream={mediaStream('video')}
        remoteStream={mediaStream('video')}
        isMicrophoneEnabled
        isCameraEnabled={false}
        toggleMicrophone={vi.fn()}
        toggleCamera={vi.fn()}
        endCall={vi.fn()}
      />
    );
    expect(screen.getByText(/désactivée/i)).toBeInTheDocument();
  });
});

// ---------- CallWindow ------------------------------------------------------

describe('CallWindow', () => {
  it('renders nothing when status is not in-call', () => {
    const { container } = render(
      <CallWindow
        callState={baseCallState}
        localStream={null}
        remoteStream={null}
        isMicrophoneEnabled
        isCameraEnabled
        onToggleMicrophone={vi.fn()}
        onToggleCamera={vi.fn()}
        onEndCall={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the audio mode (avatar fallback, hidden audio video) when type=audio', () => {
    const { container } = render(
      <CallWindow
        callState={{
          ...baseCallState,
          status: 'in-call',
          type: 'audio',
          remoteUser,
          duration: 12,
        }}
        localStream={null}
        remoteStream={mediaStream('audio')}
        isMicrophoneEnabled
        isCameraEnabled={false}
        onToggleMicrophone={vi.fn()}
        onToggleCamera={vi.fn()}
        onEndCall={vi.fn()}
      />
    );
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('00:12')).toBeInTheDocument();
    // hidden video used as audio sink
    expect(container.querySelector('video')).toBeInTheDocument();
  });

  it('renders fullscreen video + PiP in video mode and triggers the hangup', async () => {
    const onEnd = vi.fn();
    const { container } = render(
      <CallWindow
        callState={{
          ...baseCallState,
          status: 'in-call',
          type: 'video',
          remoteUser,
          duration: 0,
        }}
        localStream={mediaStream('video')}
        remoteStream={mediaStream('video')}
        isMicrophoneEnabled
        isCameraEnabled
        onToggleMicrophone={vi.fn()}
        onToggleCamera={vi.fn()}
        onEndCall={onEnd}
      />
    );
    expect(container.querySelectorAll('video').length).toBe(2);

    const buttons = screen.getAllByRole('button');
    // The hangup button is the middle one of CallControls
    const hangup = buttons.find((b) => (b as HTMLElement).style.backgroundColor.match(/rgb\(239, 68, 68\)/));
    expect(hangup).toBeTruthy();
    await userEvent.setup().click(hangup as HTMLElement);
    expect(onEnd).toHaveBeenCalled();
  });

  it('shows "Connexion vidéo en cours" placeholder when video mode has no remote stream', () => {
    render(
      <CallWindow
        callState={{ ...baseCallState, status: 'in-call', type: 'video', remoteUser }}
        localStream={mediaStream('video')}
        remoteStream={null}
        isMicrophoneEnabled
        isCameraEnabled
        onToggleMicrophone={vi.fn()}
        onToggleCamera={vi.fn()}
        onEndCall={vi.fn()}
      />
    );
    expect(screen.getByText(/Connexion vidéo en cours/i)).toBeInTheDocument();
  });

  it('shows the camera-off note when isCameraEnabled is false in video mode', () => {
    render(
      <CallWindow
        callState={{ ...baseCallState, status: 'in-call', type: 'video', remoteUser }}
        localStream={mediaStream('video')}
        remoteStream={mediaStream('video')}
        isMicrophoneEnabled
        isCameraEnabled={false}
        onToggleMicrophone={vi.fn()}
        onToggleCamera={vi.fn()}
        onEndCall={vi.fn()}
      />
    );
    expect(screen.getByText(/Votre caméra est désactivée/i)).toBeInTheDocument();
  });
});
