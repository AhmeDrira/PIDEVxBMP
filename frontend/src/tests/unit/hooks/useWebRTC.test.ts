import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWebRTC } from '@/hooks/useWebRTC';

class MockRTCPeerConnection {
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: { streams: MediaStream[] }) => void) | null = null;

  addTrack = vi.fn();
  createOffer = vi.fn(async () => ({ type: 'offer', sdp: 'offer-sdp' }));
  setLocalDescription = vi.fn(async () => {});
  createAnswer = vi.fn(async () => ({ type: 'answer', sdp: 'answer-sdp' }));
  setRemoteDescription = vi.fn(async () => {});
  addIceCandidate = vi.fn(async () => {});
  close = vi.fn();
}

describe('useWebRTC', () => {
  beforeEach(() => {
    vi.stubGlobal('RTCPeerConnection', MockRTCPeerConnection as any);
    vi.stubGlobal('RTCSessionDescription', function RTCSessionDescription(description: unknown) {
      return description;
    });
    vi.stubGlobal('RTCIceCandidate', function RTCIceCandidate(candidate: unknown) {
      return candidate;
    });
  });

  it('should start an audio call and emit WebRTC offer through socket', async () => {
    // Arrange
    const stopTrack = vi.fn();
    const audioTrack = { enabled: true, stop: stopTrack } as unknown as MediaStreamTrack;
    const mockStream = {
      getTracks: () => [audioTrack],
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
    } as unknown as MediaStream;

    const getUserMediaMock = navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>;
    getUserMediaMock.mockResolvedValue(mockStream);

    const socket = {
      emit: vi.fn(),
    };

    const { result } = renderHook(() => useWebRTC(socket as any, 'conv-1'));

    // Act
    await act(async () => {
      await result.current.startCall('audio');
    });

    // Assert
    expect(getUserMediaMock).toHaveBeenCalledWith({ audio: true, video: false });
    expect(socket.emit).toHaveBeenCalledWith(
      'call:offer',
      expect.objectContaining({ conversationId: 'conv-1' })
    );
    expect(result.current.localStream).not.toBeNull();
  });

  it('should stop tracks and reset media state when ending a call', async () => {
    // Arrange
    const stopTrack = vi.fn();
    const audioTrack = { enabled: true, stop: stopTrack } as unknown as MediaStreamTrack;
    const mockStream = {
      getTracks: () => [audioTrack],
      getAudioTracks: () => [audioTrack],
      getVideoTracks: () => [],
    } as unknown as MediaStream;

    const getUserMediaMock = navigator.mediaDevices.getUserMedia as unknown as ReturnType<typeof vi.fn>;
    getUserMediaMock.mockResolvedValue(mockStream);

    const socket = {
      emit: vi.fn(),
    };

    const { result } = renderHook(() => useWebRTC(socket as any, 'conv-2'));

    await act(async () => {
      await result.current.startCall('audio');
    });

    // Act
    act(() => {
      result.current.endCall();
    });

    // Assert
    await waitFor(() => {
      expect(result.current.localStream).toBeNull();
    });
    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(result.current.remoteStream).toBeNull();
    expect(result.current.isMicrophoneEnabled).toBe(true);
    expect(result.current.isCameraEnabled).toBe(true);
  });
});
