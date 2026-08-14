/**
 * VoxNet WebRTC Free P2P Voice & Video Caller Application
 */

class VoxNetApp {
    constructor() {
        this.peer = null;
        this.myPeerId = null;
        this.currentCall = null;
        this.dataConnection = null;
        this.localStream = null;
        this.screenStream = null;
        
        // Media Track State
        this.audioEnabled = true;
        this.videoEnabled = true;
        this.isScreenSharing = false;

        // Timer & Audio Context
        this.callStartTime = null;
        this.timerInterval = null;
        this.audioContext = null;
        this.analyser = null;

        this.initDOM();
        this.initAudioContext();
        this.setupMediaDevices();
        this.initPeerConnection();
        this.checkURLParams();
        this.bindEvents();
    }

    initDOM() {
        this.dom = {
            networkStatus: document.getElementById('network-status'),
            lobbyView: document.getElementById('lobby-view'),
            callView: document.getElementById('call-view'),
            
            // Preview
            localPreviewVideo: document.getElementById('local-preview-video'),
            previewAvatar: document.getElementById('preview-avatar'),
            micLevelFill: document.getElementById('mic-level-fill'),
            togglePreviewMic: document.getElementById('toggle-preview-mic'),
            togglePreviewCam: document.getElementById('toggle-preview-cam'),
            
            // Lobby Inputs & Actions
            myPeerIdInput: document.getElementById('my-peer-id'),
            copyMyIdBtn: document.getElementById('copy-my-id-btn'),
            createRoomBtn: document.getElementById('create-room-btn'),
            targetPeerIdInput: document.getElementById('target-peer-id'),
            startCallBtn: document.getElementById('start-call-btn'),
            
            // Active Call UI
            activeRoomId: document.getElementById('active-room-id'),
            callTimer: document.getElementById('call-timer'),
            copyRoomLinkBtn: document.getElementById('copy-room-link-btn'),
            localVideo: document.getElementById('local-video'),
            remoteVideo: document.getElementById('remote-video'),
            localAvatar: document.getElementById('local-avatar'),
            remoteAvatar: document.getElementById('remote-avatar'),
            
            // Call Controls
            callToggleMic: document.getElementById('call-toggle-mic'),
            callToggleCam: document.getElementById('call-toggle-cam'),
            callShareScreen: document.getElementById('call-share-screen'),
            playSfxBell: document.getElementById('play-sfx-bell'),
            endCallBtn: document.getElementById('end-call-btn'),
            
            // Chat
            toggleChatBtn: document.getElementById('toggle-chat-btn'),
            chatDrawer: document.getElementById('chat-drawer'),
            closeChatBtn: document.getElementById('close-chat-btn'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            sendChatBtn: document.getElementById('send-chat-btn'),
            
            toastContainer: document.getElementById('toast-container')
        };
    }

    initAudioContext() {
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
    }

    // Synthesize Audio SFX using Web Audio API
    playAudioSFX(type) {
        if (!this.audioContext) return;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        const now = this.audioContext.currentTime;
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();

        osc.connect(gain);
        gain.connect(this.audioContext.destination);

        if (type === 'ringtone') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(480, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'connect') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'disconnect') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(200, now + 0.15);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === 'bell') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            osc.start(now);
            osc.stop(now + 0.8);
        }
    }

    async setupMediaDevices() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: { width: { ideal: 1280 }, height: { ideal: 720 } }
            });

            this.dom.localPreviewVideo.srcObject = this.localStream;
            this.dom.localVideo.srcObject = this.localStream;
            this.setupAudioMeter(this.localStream);
        } catch (err) {
            console.warn('Camera/Microphone access limited or denied:', err);
            this.showToast('Microphone or Camera access missing. Voice-only mode active.');
            this.videoEnabled = false;
            this.dom.previewAvatar.classList.add('visible');
            this.dom.localAvatar.classList.add('visible');
        }
    }

    setupAudioMeter(stream) {
        if (!stream.getAudioTracks().length) return;
        try {
            const source = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64;
            source.connect(this.analyser);

            const bufferLength = this.analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateMeter = () => {
                if (!this.analyser) return;
                this.analyser.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                    sum += dataArray[i];
                }
                const average = sum / bufferLength;
                const percent = Math.min(100, Math.round((average / 128) * 100));
                this.dom.micLevelFill.style.width = `${percent}%`;
                requestAnimationFrame(updateMeter);
            };
            updateMeter();
        } catch (e) {
            console.error('Audio meter init error:', e);
        }
    }

    initPeerConnection() {
        // Generate random room prefix if desired
        const randomId = 'vox-' + Math.floor(1000 + Math.random() * 9000);
        
        // Initialize PeerJS client with free STUN servers
        this.peer = new Peer(randomId, {
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' }
                ]
            }
        });

        this.peer.on('open', (id) => {
            this.myPeerId = id;
            this.dom.myPeerIdInput.value = id;
            this.dom.networkStatus.textContent = 'Connected (ID: ' + id + ')';
            this.showToast('Online Caller ready! Share your ID to start.');
        });

        this.peer.on('call', (call) => {
            this.showToast('Incoming Call from ' + call.peer + '...');
            this.playAudioSFX('ringtone');
            call.answer(this.localStream);
            this.setupCallHandlers(call);
        });

        this.peer.on('connection', (conn) => {
            this.setupDataConnection(conn);
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            this.showToast('Connection Error: ' + err.type);
            this.dom.networkStatus.textContent = 'Error connecting';
        });
    }

    checkURLParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
            this.dom.targetPeerIdInput.value = roomParam;
            this.showToast('Call ID loaded from URL link. Press "Call Now"!');
        }
    }

    bindEvents() {
        // Copy My ID
        this.dom.copyMyIdBtn.addEventListener('click', () => {
            if (!this.myPeerId) return;
            navigator.clipboard.writeText(this.myPeerId);
            this.showToast('Copied Call ID to clipboard!');
        });

        // Create Room
        this.dom.createRoomBtn.addEventListener('click', () => {
            if (!this.myPeerId) return;
            const roomUrl = `${window.location.origin}${window.location.pathname}?room=${this.myPeerId}`;
            navigator.clipboard.writeText(roomUrl);
            this.showToast('Call Link copied! Send it to your friend.');
        });

        // Start Call
        this.dom.startCallBtn.addEventListener('click', () => {
            const targetId = this.dom.targetPeerIdInput.value.trim();
            if (!targetId) {
                this.showToast('Please enter a Call ID first!');
                return;
            }
            if (targetId === this.myPeerId) {
                this.showToast('Cannot call yourself! Enter a friend\'s ID.');
                return;
            }
            this.initiateCall(targetId);
        });

        // Preview Toggles
        this.dom.togglePreviewMic.addEventListener('click', () => this.toggleAudio('preview'));
        this.dom.togglePreviewCam.addEventListener('click', () => this.toggleVideo('preview'));

        // In-Call Controls
        this.dom.callToggleMic.addEventListener('click', () => this.toggleAudio('call'));
        this.dom.callToggleCam.addEventListener('click', () => this.toggleVideo('call'));
        this.dom.callShareScreen.addEventListener('click', () => this.toggleScreenShare());
        this.dom.playSfxBell.addEventListener('click', () => {
            this.playAudioSFX('bell');
            this.sendChatMessage('[Ring Bell SFX]');
        });
        this.dom.endCallBtn.addEventListener('click', () => this.endCall());

        // Copy Room Link during Call
        this.dom.copyRoomLinkBtn.addEventListener('click', () => {
            const activeId = this.dom.activeRoomId.textContent;
            const roomUrl = `${window.location.origin}${window.location.pathname}?room=${activeId}`;
            navigator.clipboard.writeText(roomUrl);
            this.showToast('Call link copied to clipboard!');
        });

        // Chat Toggles & Sending
        this.dom.toggleChatBtn.addEventListener('click', () => {
            this.dom.chatDrawer.classList.toggle('open');
        });
        this.dom.closeChatBtn.addEventListener('click', () => {
            this.dom.chatDrawer.classList.remove('open');
        });
        this.dom.sendChatBtn.addEventListener('click', () => this.sendUserChatMessage());
        this.dom.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendUserChatMessage();
        });
    }

    initiateCall(targetPeerId) {
        this.showToast('Calling ' + targetPeerId + '...');
        this.playAudioSFX('ringtone');

        // Connect audio/video media call
        const call = this.peer.call(targetPeerId, this.localStream);
        this.setupCallHandlers(call);

        // Connect P2P data channel for chat
        const conn = this.peer.connect(targetPeerId);
        this.setupDataConnection(conn);
    }

    setupCallHandlers(call) {
        this.currentCall = call;

        call.on('stream', (remoteStream) => {
            this.dom.remoteVideo.srcObject = remoteStream;
            this.dom.remoteAvatar.classList.remove('visible');
            this.switchToCallView(call.peer);
            this.playAudioSFX('connect');
            this.startCallTimer();
        });

        call.on('close', () => {
            this.endCall(false);
        });

        call.on('error', (err) => {
            console.error('Call Error:', err);
            this.showToast('Call error: ' + err.message);
            this.endCall(false);
        });
    }

    setupDataConnection(conn) {
        this.dataConnection = conn;
        conn.on('data', (data) => {
            if (typeof data === 'string') {
                this.receiveChatMessage(data, 'received');
            }
        });
    }

    switchToCallView(peerId) {
        this.dom.lobbyView.classList.remove('active');
        this.dom.callView.classList.add('active');
        this.dom.activeRoomId.textContent = peerId;
    }

    startCallTimer() {
        this.callStartTime = Date.now();
        this.dom.callTimer.textContent = '00:00';
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
            const secs = String(elapsed % 60).padStart(2, '0');
            this.dom.callTimer.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    toggleAudio(mode) {
        this.audioEnabled = !this.audioEnabled;
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => track.enabled = this.audioEnabled);
        }

        const btn = mode === 'preview' ? this.dom.togglePreviewMic : this.dom.callToggleMic;
        btn.classList.toggle('active', this.audioEnabled);
        btn.classList.toggle('off', !this.audioEnabled);
        btn.querySelector('i').className = this.audioEnabled ? 'fa-solid fa-microphone' : 'fa-solid fa-microphone-slash';
        this.showToast(this.audioEnabled ? 'Microphone Unmuted' : 'Microphone Muted');
    }

    toggleVideo(mode) {
        this.videoEnabled = !this.videoEnabled;
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => track.enabled = this.videoEnabled);
        }

        const btn = mode === 'preview' ? this.dom.togglePreviewCam : this.dom.callToggleCam;
        btn.classList.toggle('active', this.videoEnabled);
        btn.classList.toggle('off', !this.videoEnabled);
        btn.querySelector('i').className = this.videoEnabled ? 'fa-solid fa-video' : 'fa-solid fa-video-slash';

        this.dom.previewAvatar.classList.toggle('visible', !this.videoEnabled);
        this.dom.localAvatar.classList.toggle('visible', !this.videoEnabled);

        this.showToast(this.videoEnabled ? 'Camera Enabled' : 'Camera Disabled');
    }

    async toggleScreenShare() {
        if (!this.isScreenSharing) {
            try {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = this.screenStream.getVideoTracks()[0];

                if (this.currentCall) {
                    const sender = this.currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                }
                this.dom.localVideo.srcObject = this.screenStream;
                this.dom.callShareScreen.classList.add('active');
                this.isScreenSharing = true;

                screenTrack.onended = () => this.stopScreenShare();
                this.showToast('Screen sharing started.');
            } catch (e) {
                console.warn('Screen share cancelled/denied:', e);
            }
        } else {
            this.stopScreenShare();
        }
    }

    stopScreenShare() {
        if (this.screenStream) {
            this.screenStream.getTracks().forEach(track => track.stop());
            this.screenStream = null;
        }
        if (this.currentCall && this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            const sender = this.currentCall.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender && videoTrack) sender.replaceTrack(videoTrack);
        }
        this.dom.localVideo.srcObject = this.localStream;
        this.dom.callShareScreen.classList.remove('active');
        this.isScreenSharing = false;
        this.showToast('Stopped screen share.');
    }

    sendUserChatMessage() {
        const text = this.dom.chatInput.value.trim();
        if (!text) return;
        this.sendChatMessage(text);
        this.dom.chatInput.value = '';
    }

    sendChatMessage(text) {
        if (this.dataConnection && this.dataConnection.open) {
            this.dataConnection.send(text);
        }
        this.receiveChatMessage(text, 'sent');
    }

    receiveChatMessage(text, type) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${type}`;
        msgDiv.textContent = text;
        this.dom.chatMessages.appendChild(msgDiv);
        this.dom.chatMessages.scrollTop = this.dom.chatMessages.scrollHeight;
    }

    endCall(notify = true) {
        if (notify) this.playAudioSFX('disconnect');
        if (this.currentCall) {
            this.currentCall.close();
            this.currentCall = null;
        }
        if (this.dataConnection) {
            this.dataConnection.close();
            this.dataConnection = null;
        }
        if (this.isScreenSharing) {
            this.stopScreenShare();
        }

        clearInterval(this.timerInterval);
        this.dom.callView.classList.remove('active');
        this.dom.lobbyView.classList.add('active');
        this.dom.chatDrawer.classList.remove('open');
        this.showToast('Call ended.');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        this.dom.toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.voxApp = new VoxNetApp();
});
