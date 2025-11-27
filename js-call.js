// js-call.js - WebRTC Calling Logic with Firebase Fixed

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
// আইডি ফিক্স করা হয়েছে
const callModal = document.getElementById('call-interface-modal'); 
const incomingCallModal = document.getElementById('incoming-call-modal');
const callStatus = document.getElementById('call-status');
const callPartnerName = document.getElementById('call-partner-name');

let localStream;
let peerConnection;
let currentCallRef;
let incomingCallData = null;

// STUN Servers
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

// 1. কল শুরু করার ফাংশন (Start Call)
async function startCall(isVideo) {
    // চেক করা হচ্ছে currentChatId আছে কিনা (js-chat.js থেকে আসার কথা)
    if (typeof currentChatId === 'undefined' || !currentChatId) {
        alert("Please select a friend to call first!");
        return;
    }
    
    const friendId = currentChatId; 

    try {
        // নিজের ক্যামেরা/মাইক চালু করা
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        localVideo.srcObject = localStream;
        
        // UI আপডেট (আগে এখানে ভুল আইডি ছিল, এখন ভেরিয়েবল ব্যবহার করা হয়েছে)
        callModal.classList.remove('hidden'); 
        
        // নামের টেক্সট সেট করা
        const chatHeaderName = document.getElementById('chat-header-name');
        if(chatHeaderName) {
            callPartnerName.textContent = chatHeaderName.textContent;
        } else {
            callPartnerName.textContent = "Friend";
        }
        
        callStatus.textContent = "Calling...";

        // Peer Connection তৈরি
        createPeerConnection(friendId);

        // Offer তৈরি করা
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Firebase এ কল রিকোয়েস্ট পাঠানো
        const callId = db.ref('calls').push().key;
        currentCallRef = db.ref(`calls/${friendId}/${callId}`);
        
        // নিজের নাম নেয়া
        const myNameElement = document.getElementById('profile-view-name');
        const myName = myNameElement ? myNameElement.textContent : "Unknown";

        await currentCallRef.set({
            callerId: currentUser.uid,
            callerName: myName, 
            type: 'offer',
            isVideo: isVideo,
            sdp: JSON.stringify(peerConnection.localDescription)
        });

        // সিগন্যালিং শোনা (Call Answered?)
        listenForAnswer(friendId, callId);

    } catch (error) {
        console.error("Error starting call:", error);
        alert("Could not access camera/microphone. Please allow permissions.");
        endCall();
    }
}

// 2. Peer Connection সেটআপ
function createPeerConnection(partnerId) {
    peerConnection = new RTCPeerConnection(servers);

    // স্ট্রিম যোগ করা
    if(localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // রিমোট স্ট্রিম রিসিভ করা
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // ICE Candidate হ্যান্ডেল করা
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && currentCallRef) {
            currentCallRef.child('candidates').push(JSON.stringify(event.candidate));
        }
    };
}

// 3. ইনকামিং কল শোনা (Listen for Calls)
function listenForIncomingCalls() {
    if (!currentUser) return;
    
    const myCallsRef = db.ref(`calls/${currentUser.uid}`);
    
    // আগের লিসেনার রিমুভ করা যাতে ডুপ্লিকেট না হয়
    myCallsRef.off();

    myCallsRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        if (data && data.type === 'offer') {
            // ইনকামিং কল পাওয়া গেছে
            incomingCallData = { ...data, key: snapshot.key };
            showIncomingCallUI(data.callerName, data.isVideo);
        }
    });
    
    // কল কেটে দিলে শোনা
    myCallsRef.on('child_removed', (snapshot) => {
         hideIncomingCallUI();
         endCallUI(); // UI রিসেট
    });
}

function showIncomingCallUI(name, isVideo) {
    const callerNameEl = document.getElementById('incoming-caller-name');
    if(callerNameEl) callerNameEl.textContent = name;
    
    if(incomingCallModal) incomingCallModal.classList.remove('hidden');
}

function hideIncomingCallUI() {
    if(incomingCallModal) incomingCallModal.classList.add('hidden');
}

function endCallUI() {
    if(callModal) callModal.classList.add('hidden');
    callStatus.textContent = "Ended";
    if(localVideo) localVideo.srcObject = null;
    if(remoteVideo) remoteVideo.srcObject = null;
}

// 4. কল রিসিভ করা (Answer Call)
const acceptBtn = document.getElementById('accept-call-btn');
if(acceptBtn) {
    acceptBtn.addEventListener('click', async () => {
        hideIncomingCallUI();
        callModal.classList.remove('hidden');
        callStatus.textContent = "Connecting...";
        
        try {
            const isVideo = incomingCallData.isVideo;
            localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
            localVideo.srcObject = localStream;

            peerConnection = new RTCPeerConnection(servers);
            
            // স্ট্রিম যোগ
            localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

            // রিমোট ভিডিও সেট
            peerConnection.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0];
            };

            // রিমোট অফার সেট করা
            await peerConnection.setRemoteDescription(JSON.parse(incomingCallData.sdp));

            // উত্তর তৈরি (Answer)
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Firebase এ উত্তর পাঠানো
            currentCallRef = db.ref(`calls/${currentUser.uid}/${incomingCallData.key}`);
            await currentCallRef.update({
                type: 'answer',
                sdp: JSON.stringify(peerConnection.localDescription)
            });
            
            // ICE Candidate পাঠানো (Answerer -> Caller)
            peerConnection.onicecandidate = (event) => {
                if (event.candidate) {
                    currentCallRef.child('candidates').push(JSON.stringify(event.candidate));
                }
            };
            
            // Caller এর ক্যান্ডিডেট শোনা
            currentCallRef.child('candidates').on('child_added', (snapshot) => {
                const candidate = JSON.parse(snapshot.val());
                // রিমোট ক্যান্ডিডেট অ্যাড করার আগে চেক করা দরকার রিমোট ডেসক্রিপশন সেট হয়েছে কিনা
                if(peerConnection.remoteDescription) {
                     peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            });

        } catch (e) {
            console.error(e);
            endCall();
        }
    });
}

// 5. Caller এর জন্য Answer শোনা
function listenForAnswer(friendId, callId) {
    const callRef = db.ref(`calls/${friendId}/${callId}`);
    
    callRef.on('value', async (snapshot) => {
        const data = snapshot.val();
        if (data && data.type === 'answer' && !peerConnection.currentRemoteDescription) {
            callStatus.textContent = "Connected";
            const answer = JSON.parse(data.sdp);
            await peerConnection.setRemoteDescription(answer);
        }
    });

    // Receiver এর ক্যান্ডিডেট শোনা
    callRef.child('candidates').on('child_added', (snapshot) => {
        const candidate = JSON.parse(snapshot.val());
        if(peerConnection && peerConnection.remoteDescription) {
            peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
    });
}

// 6. কল কেটে দেওয়া (End Call)
function endCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    
    endCallUI();
    hideIncomingCallUI();
    
    // Firebase থেকে ডাটা ডিলিট
    if (currentCallRef) currentCallRef.remove();
    
    peerConnection = null;
    localStream = null;
    currentCallRef = null;
}

// বাটন ইভেন্ট লিসেনার সেটআপ
const videoCallBtn = document.getElementById('header-video-call-btn');
const audioCallBtn = document.getElementById('header-audio-call-btn');
const modalVideoBtn = document.getElementById('modal-video-call-btn');
const modalAudioBtn = document.getElementById('modal-audio-call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

if(videoCallBtn) videoCallBtn.addEventListener('click', () => startCall(true));
if(audioCallBtn) audioCallBtn.addEventListener('click', () => startCall(false));

if(modalVideoBtn) {
    modalVideoBtn.addEventListener('click', () => {
        document.getElementById('partner-profile-modal').classList.add('hidden');
        startCall(true);
    });
}

if(modalAudioBtn) {
    modalAudioBtn.addEventListener('click', () => {
        document.getElementById('partner-profile-modal').classList.add('hidden');
        startCall(false);
    });
}

if(endCallBtn) endCallBtn.addEventListener('click', endCall);

if(rejectCallBtn) {
    rejectCallBtn.addEventListener('click', () => {
        hideIncomingCallUI();
        if(incomingCallData) {
            db.ref(`calls/${currentUser.uid}/${incomingCallData.key}`).remove();
        }
    });
}

// লগইন চেক এবং ইনকামিং কল লিসেনার
// এটি নিশ্চিত করে যে Firebase লোড হওয়ার পর লিসেনার চালু হবে
const checkAuthInterval = setInterval(() => {
    if (typeof firebase !== 'undefined' && firebase.auth()) {
        clearInterval(checkAuthInterval);
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // currentUser গ্লোবাল ভেরিয়েবল সেট করা হয়েছে কিনা নিশ্চিত হয়ে নাও js-auth.js এ
                listenForIncomingCalls();
            }
        });
    }
}, 500);