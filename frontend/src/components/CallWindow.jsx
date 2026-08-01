import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../socket/socket';
import Avatar from './Avatar';

const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

export default function CallWindow({ conversationId, isVideo, status, conversationName, currentUser, onEnd }) {
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> { stream, name }
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [callStatus, setCallStatus] = useState(status); // 'calling' | 'connected'

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});

  const createPeerConnection = useCallback((peerSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));

    pc.onicecandidate = (event) => {
      if (event.candidate) socket.emit('call:ice-candidate', { to: peerSocketId, candidate: event.candidate });
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerSocketId]: { ...(prev[peerSocketId] || {}), stream: event.streams[0] },
      }));
    };

    peerConnectionsRef.current[peerSocketId] = pc;
    return pc;
  }, []);

  // --- Get local camera/mic the moment this window mounts (both for the
  //     caller, who sees themselves while "Calling...", and the callee,
  //     who mounts this only after accepting) ---
  useEffect(() => {
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        alert('Could not access camera/microphone: ' + err.message);
        onEnd();
      }
    })();

    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The accepting side gets told who's already on the call and is
    // responsible for sending THEM the offer - same one-directional rule
    // as CodeSync's video calling, avoiding both sides offering at once.
    const onExistingPeers = async ({ conversationId: cid, peers }) => {
      if (cid !== conversationId) return;
      for (const peer of peers) {
        const pc = createPeerConnection(peer.socketId);
        setRemoteStreams((prev) => ({ ...prev, [peer.socketId]: { name: peer.name } }));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:offer', { to: peer.socketId, offer });
      }
      setCallStatus('connected');
    };

    const onAccepted = ({ conversationId: cid, socketId }) => {
      if (cid !== conversationId || socketId === socket.id) return;
      setCallStatus('connected');
    };

    const onOffer = async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call:answer', { to: from, answer });
      setCallStatus('connected');
    };

    const onAnswer = async ({ from, answer }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const onPeerLeft = ({ socketId }) => {
      peerConnectionsRef.current[socketId]?.close();
      delete peerConnectionsRef.current[socketId];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    const onEnded = ({ conversationId: cid }) => {
      if (cid === conversationId) onEnd();
    };
    const onDeclined = ({ conversationId: cid }) => {
      if (cid === conversationId) onEnd();
    };
    const onMissed = ({ conversationId: cid }) => {
      if (cid === conversationId) onEnd();
    };

    socket.on('call:existing-peers', onExistingPeers);
    socket.on('call:accepted', onAccepted);
    socket.on('call:offer', onOffer);
    socket.on('call:answer', onAnswer);
    socket.on('call:ice-candidate', onIceCandidate);
    socket.on('call:peer-left', onPeerLeft);
    socket.on('call:ended', onEnded);
    socket.on('call:declined', onDeclined);
    socket.on('call:missed', onMissed);

    return () => {
      socket.off('call:existing-peers', onExistingPeers);
      socket.off('call:accepted', onAccepted);
      socket.off('call:offer', onOffer);
      socket.off('call:answer', onAnswer);
      socket.off('call:ice-candidate', onIceCandidate);
      socket.off('call:peer-left', onPeerLeft);
      socket.off('call:ended', onEnded);
      socket.off('call:declined', onDeclined);
      socket.off('call:missed', onMissed);
    };
  }, [conversationId, createPeerConnection, onEnd]);

  const toggleMute = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOff(!videoTrack.enabled);
    }
  };

  const handleEnd = () => {
    // If nobody has answered yet, this is a cancel (so it logs correctly as
    // "Call cancelled" instead of a bogus near-zero-duration "completed" call).
    // Once at least one other participant has joined, it's a normal leave.
    if (callStatus === 'calling') {
      socket.emit('call:cancel', { conversationId });
    } else {
      socket.emit('call:leave', { conversationId });
    }
    onEnd();
  };

  const remoteEntries = Object.entries(remoteStreams);

  return (
    <div className="call-window-overlay">
      <div className="call-window-status-bar">
        {callStatus === 'calling' ? `Calling ${conversationName}...` : conversationName}
      </div>

      <div className={`call-grid ${isVideo ? '' : 'voice-only'}`}>
        {isVideo ? (
          <div className="call-tile local-tile">
            <video ref={localVideoRef} autoPlay muted playsInline />
            <span className="call-tile-label">{currentUser.name} (You)</span>
          </div>
        ) : (
          <div className="voice-avatar-tile">
            <Avatar name={currentUser.name} color={currentUser.avatarColor} size={90} />
            <span>{currentUser.name} (You)</span>
          </div>
        )}

        {remoteEntries.map(([socketId, { stream, name }]) => (
          <RemoteTile key={socketId} stream={stream} name={name} isVideo={isVideo} />
        ))}
      </div>

      <div className="call-controls">
        <button className={`call-control-btn ${muted ? 'active' : ''}`} onClick={toggleMute}>
          {muted ? '🔇' : '🎤'}
        </button>
        {isVideo && (
          <button className={`call-control-btn ${cameraOff ? 'active' : ''}`} onClick={toggleCamera}>
            {cameraOff ? '📷' : '🎥'}
          </button>
        )}
        <button className="call-control-btn end-call" onClick={handleEnd}>📞</button>
      </div>
    </div>
  );
}

function RemoteTile({ stream, name, isVideo }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  if (!isVideo) {
    return (
      <div className="voice-avatar-tile">
        <Avatar name={name} color="#5e6c84" size={90} />
        <span>{name || 'Connecting...'}</span>
      </div>
    );
  }

  return (
    <div className="call-tile">
      <video ref={videoRef} autoPlay playsInline />
      <span className="call-tile-label">{name || 'Connecting...'}</span>
    </div>
  );
}
