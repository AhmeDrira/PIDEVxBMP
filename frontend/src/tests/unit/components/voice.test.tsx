/**
 * Tests for voice-related components:
 *   - VoiceMessage : play/pause toggling, seek, time formatting, multi-instance
 *     coordination via 'stop-all-audio' custom event
 *   - VoiceRecorder : start/stop record (with mocked MediaRecorder + getUserMedia),
 *     review pane (cancel + send), unsupported browser branch
 */

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import VoiceMessage from '@/components/common/VoiceMessage';
import VoiceRecorder from '@/components/common/VoiceRecorder';

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

afterEach(() => {
  vi.useRealTimers();
});

// ---------- VoiceMessage ----------------------------------------------------

describe('VoiceMessage', () => {
  it('renders the play button, duration label, and progress slider', () => {
    render(<VoiceMessage url="/audio/abc.webm" duration={75} isSelf={false} messageId="m1" />);

    expect(screen.getByRole('button', { name: /play voice message/i })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: /voice message progress/i })).toBeInTheDocument();
    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(screen.getByText('01:15')).toBeInTheDocument();
  });

  it('toggles between play and pause on click', async () => {
    const user = userEvent.setup();
    render(<VoiceMessage url="/x.webm" duration={30} isSelf messageId="m2" />);

    const btn = screen.getByRole('button', { name: /play voice message/i });
    await user.click(btn);
    expect(screen.getByRole('button', { name: /pause voice message/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /pause voice message/i }));
    expect(screen.getByRole('button', { name: /play voice message/i })).toBeInTheDocument();
  });

  it('updates the progress when the slider changes', () => {
    render(<VoiceMessage url="/x.webm" duration={120} isSelf={false} messageId="m3" />);
    const slider = screen.getByRole('slider', { name: /voice message progress/i }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '40' } });
    expect(slider.value).toBe('40');
    // formatTime(40) = "00:40"
    expect(screen.getByText('00:40')).toBeInTheDocument();
  });

  it('pauses other voice messages when one starts playing (stop-all-audio event)', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <VoiceMessage url="/a.webm" duration={10} isSelf={false} messageId="ma" />
        <VoiceMessage url="/b.webm" duration={10} isSelf={false} messageId="mb" />
      </div>
    );

    // Start playback on the first message
    const firstPlay = screen.getAllByRole('button', { name: /play voice message/i })[0];
    await user.click(firstPlay);
    expect(screen.getAllByRole('button', { name: /pause voice message/i })).toHaveLength(1);

    // Start playback on the second one — this dispatches stop-all-audio with messageId=mb,
    // so the first message should pause.
    const secondPlay = screen.getByRole('button', { name: /play voice message/i });
    await user.click(secondPlay);
    expect(screen.getAllByRole('button', { name: /pause voice message/i })).toHaveLength(1);
    // The "play" button visible now corresponds to the first (paused) message
    expect(screen.getAllByRole('button', { name: /play voice message/i })).toHaveLength(1);
  });

  it('renders 00:00 when duration is NaN', () => {
    render(<VoiceMessage url="/x.webm" duration={NaN as any} isSelf messageId="mn" />);
    // Both labels render 00:00
    expect(screen.getAllByText('00:00').length).toBeGreaterThanOrEqual(2);
  });
});

// ---------- VoiceRecorder ---------------------------------------------------

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  static isTypeSupported = vi.fn(() => true);

  state = 'inactive';
  ondataavailable: ((e: any) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public stream: MediaStream) {
    MockMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    // Provide one chunk of fake audio data
    this.ondataavailable?.({ data: new Blob(['x'], { type: 'audio/webm' }), size: 1 });
    this.onstop?.();
  }
}

const installMediaRecorderMock = () => {
  MockMediaRecorder.instances = [];
  Object.defineProperty(globalThis, 'MediaRecorder', {
    configurable: true,
    writable: true,
    value: MockMediaRecorder,
  });
  (globalThis as any).MediaRecorder.isTypeSupported = MockMediaRecorder.isTypeSupported;
};

describe('VoiceRecorder', () => {
  it('renders the mic button initially and is disabled when prop is set', () => {
    render(
      <VoiceRecorder onSend={vi.fn()} onCancel={vi.fn()} disabled />
    );
    expect(screen.getByRole('button', { name: /Message vocal/i })).toBeDisabled();
  });

  it('alerts when MediaDevices.getUserMedia is unavailable', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const original = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    const user = userEvent.setup();
    render(<VoiceRecorder onSend={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Message vocal/i }));
    expect(alertSpy).toHaveBeenCalled();

    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original });
    alertSpy.mockRestore();
  });

  it('records → stops → shows the review pane → sends', async () => {
    installMediaRecorderMock();
    const audioStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(audioStream);

    const onSend = vi.fn();
    const onCancel = vi.fn();
    const onStateChange = vi.fn();

    const user = userEvent.setup();
    render(<VoiceRecorder onSend={onSend} onCancel={onCancel} onStateChange={onStateChange} />);

    // Start
    await user.click(screen.getByRole('button', { name: /Message vocal/i }));
    // After awaiting getUserMedia, state moves to recording
    expect(screen.getByTitle(/Arrêter l'enregistrement/i)).toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith(true);

    // Stop → triggers onstop → chunks → audio blob → audioUrl set → review pane
    await user.click(screen.getByTitle(/Arrêter l'enregistrement/i));
    expect(screen.getByRole('button', { name: /Envoyer/i })).toBeInTheDocument();

    // Send
    await user.click(screen.getByRole('button', { name: /Envoyer/i }));
    expect(onSend).toHaveBeenCalledWith(expect.any(Blob), expect.any(Number));
  });

  it('cancels the review pane', async () => {
    installMediaRecorderMock();
    const audioStream = {
      getTracks: () => [{ stop: vi.fn() }],
      getAudioTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream;
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(audioStream);

    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<VoiceRecorder onSend={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /Message vocal/i }));
    await user.click(screen.getByTitle(/Arrêter l'enregistrement/i));
    expect(screen.getByRole('button', { name: /Envoyer/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Annuler/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    // Back to mic button
    expect(screen.getByRole('button', { name: /Message vocal/i })).toBeInTheDocument();
  });

  it('alerts when the microphone permission is rejected', async () => {
    installMediaRecorderMock();
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(new Error('NotAllowedError'));
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    const user = userEvent.setup();
    render(<VoiceRecorder onSend={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Message vocal/i }));
    expect(alertSpy).toHaveBeenCalledWith('Permission du microphone refusée.');
    alertSpy.mockRestore();
  });
});
