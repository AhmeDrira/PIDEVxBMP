/**
 * Extra coverage for useWebRTC — exercises the branches the basic test misses:
 *   - acceptCall (offer/answer dance)
 *   - handleAnswer / handleIceCandidate (no-op when peerConnection is null)
 *   - toggleMicrophone / toggleCamera (both with and without a localStream)
 *   - retry-without-video fallback path
 *   - onicecandidate emission
 *   - ontrack handler updating remoteStream
 *   - createPeerConnection closing the previous connection
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebRTC } from '@/hooks/useWebRTC';

interface CreatedPC {
  onicecandidate: ((e: any) => void) | null;
  ontrack: ((e: any) => void) | null;
  addTrack: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  createAnswer: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  addIceCandidate: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

const createdPCs: CreatedPC[] = [];

class MockRTCPeerConnection implements CreatedPC {
  onicecandidate: ((e: any) => void) | null = null;
  ontrack: ((e: any) => void) | null = null;
  addTrack = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' }));
  setLocalDescription = vi.fn(async () => {});
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' }));
  setRemoteDescription = vi.fn(async () => {});
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();

  constructor() {
    createdPCs.push(this as unknown as CreatedPC);
  }
}

const buildAudioStream = () => {
  const audioTrack = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [audioTrack],
    getAudioTracks: () => [audioTrack],
    getVideoTracks: () => [],
    audioTrack,
  } as unknown as MediaStream & { audioTrack: any };
};

const buildVideoStream = () => {
  const audio = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
  const video = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [audio, video],
    getAudioTracks: () => [audio],
    getVideoTracks: () => [video],
    audio,
    video,
  } as unknown as MediaStream & { audio: any; video: any };
};

describe('useWebRTC — extended branches', () => {
  beforeEach(() => {
    createdPCs.length = 0;
    vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection as any);
    vi.stubGlobal('RTCSessionDescription', function (description: unknown) {
      return description;
    });
    vi.stubGlobal('RTCIceCandidate', function (candidate: unknown) {
      return candidate;
    });
  });

  it('acceptCall: applies remote offer, creates answer, emits answer', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);

    const socket = { emit: vi.fn() };
    const { result } = renderHook(() => useWebRTC(socket as any, 'conv-accept'));

    const offer = { type: 'offer', sdp: 'remote-sdp' } as RTCSessionDescriptionInit;
    await act(async () => {
      await result.current.acceptCall('audio', offer);
    });

    const pc = createdPCs[0];
    expect(pc.setRemoteDescription).toHaveBeenCalledWith(offer);
    expect(pc.createAnswer).toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'call:answer',
      expect.objectContaining({ conversationId: 'conv-accept' })
    );
  });

  it('handleAnswer: applies the remote description', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };
    const { result } = renderHook(() => useWebRTC(socket as any, 'c-1'));

    await act(async () => {
      await result.current.startCall('audio');
    });

    const answer = { type: 'answer', sdp: 'remote-answer' } as RTCSessionDescriptionInit;
    await act(async () => {
      await result.current.handleAnswer(answer);
    });

    expect(createdPCs[0].setRemoteDescription).toHaveBeenCalledWith(answer);
  });

  it('handleAnswer: no-op when peerConnection is null', async () => {
    const socket = { emit: vi.fn() };
    const { result } = renderHook(() => useWebRTC(socket as any, 'c-2'));
    await act(async () => {
      await result.current.handleAnswer({ type: 'answer' } as any);
    });
    expect(createdPCs).toHaveLength(0);
  });

  it('handleIceCandidate: forwards to the peer connection', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };
    const { result } = renderHook(() => useWebRTC(socket as any, 'c-3'));

    await act(async () => {
      await result.current.startCall('audio');
    });

    await act(async () => {
      await result.current.handleIceCandidate({ candidate: 'x' } as any);
    });

    expect(createdPCs[0].addIceCandidate).toHaveBeenCalled();
  });

  it('handleIceCandidate: no-op when no peerConnection yet', async () => {
    const { result } = renderHook(() => useWebRTC(null, 'c-no-pc'));
    await act(async () => {
      await result.current.handleIceCandidate({ candidate: 'x' } as any);
    });
    expect(createdPCs).toHaveLength(0);
  });

  it('initLocalStream: retries with audio-only when video device fails', async () => {
    const audioOnly = buildAudioStream();
    const socket = { emit: vi.fn() };

    const getUM = navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>;
    getUM.mockReset();
    getUM
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockResolvedValueOnce(audioOnly);

    const { result } = renderHook(() => useWebRTC(socket as any, 'retry'));

    await act(async () => {
      await result.current.startCall('video');
    });

    expect(getUM).toHaveBeenNthCalledWith(1, { audio: true, video: true });
    expect(getUM).toHaveBeenNthCalledWith(2, { audio: true, video: false });
    expect(socket.emit).toHaveBeenCalledWith(
      'call:offer',
      expect.objectContaining({ conversationId: 'retry' })
    );
  });

  it('initLocalStream: rethrows when retry also fails', async () => {
    const socket = { emit: vi.fn() };
    const getUM = navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>;
    getUM.mockReset();
    getUM
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockRejectedValueOnce(new Error('AudioAlsoFailed'));

    const { result } = renderHook(() => useWebRTC(socket as any, 'fail'));

    await expect(
      act(async () => {
        await result.current.startCall('video');
      })
    ).rejects.toThrow(/AudioAlsoFailed/);
  });

  it('toggleMicrophone: flips track.enabled and the state', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };

    const { result } = renderHook(() => useWebRTC(socket as any, 'tog-mic'));
    await act(async () => {
      await result.current.startCall('audio');
    });

    expect(result.current.isMicrophoneEnabled).toBe(true);
    expect((stream as any).audioTrack.enabled).toBe(true);

    act(() => {
      result.current.toggleMicrophone();
    });

    expect(result.current.isMicrophoneEnabled).toBe(false);
    expect((stream as any).audioTrack.enabled).toBe(false);
  });

  it('toggleMicrophone: no-op when there is no localStream yet', () => {
    const { result } = renderHook(() => useWebRTC(null, 'no-stream'));
    act(() => {
      result.current.toggleMicrophone();
    });
    expect(result.current.isMicrophoneEnabled).toBe(true);
  });

  it('toggleCamera: flips video track and state', async () => {
    const stream = buildVideoStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };

    const { result } = renderHook(() => useWebRTC(socket as any, 'tog-cam'));
    await act(async () => {
      await result.current.startCall('video');
    });

    expect(result.current.isCameraEnabled).toBe(true);
    expect((stream as any).video.enabled).toBe(true);

    act(() => {
      result.current.toggleCamera();
    });

    expect(result.current.isCameraEnabled).toBe(false);
    expect((stream as any).video.enabled).toBe(false);
  });

  it('toggleCamera: no-op when there is no localStream yet', () => {
    const { result } = renderHook(() => useWebRTC(null, 'no-stream-2'));
    act(() => {
      result.current.toggleCamera();
    });
    expect(result.current.isCameraEnabled).toBe(true);
  });

  it('emits call:ice-candidate when the peer connection produces a local candidate', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };

    const { result } = renderHook(() => useWebRTC(socket as any, 'ice'));
    await act(async () => {
      await result.current.startCall('audio');
    });

    const pc = createdPCs[0];
    act(() => {
      pc.onicecandidate?.({ candidate: { sdp: 'a-candidate' } });
    });

    expect(socket.emit).toHaveBeenCalledWith(
      'call:ice-candidate',
      expect.objectContaining({ conversationId: 'ice' })
    );

    // No-op branch: null candidate should not emit
    socket.emit.mockClear();
    act(() => {
      pc.onicecandidate?.({ candidate: null });
    });
    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('ontrack handler exposes the incoming remote stream', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };
    const { result } = renderHook(() => useWebRTC(socket as any, 'remote'));

    await act(async () => {
      await result.current.startCall('audio');
    });

    const pc = createdPCs[0];
    const remote = { id: 'remote-stream' } as unknown as MediaStream;
    act(() => {
      pc.ontrack?.({ streams: [remote] });
    });

    await waitFor(() => expect(result.current.remoteStream).toBe(remote));
  });

  it('createPeerConnection closes the previous connection when called twice', async () => {
    const stream = buildAudioStream();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(stream);
    const socket = { emit: vi.fn() };
    const { result } = renderHook(() => useWebRTC(socket as any, 'twice'));

    await act(async () => {
      await result.current.startCall('audio');
    });
    await act(async () => {
      await result.current.startCall('audio');
    });

    expect(createdPCs[0].close).toHaveBeenCalledTimes(1);
    expect(createdPCs.length).toBeGreaterThanOrEqual(2);
  });
});
