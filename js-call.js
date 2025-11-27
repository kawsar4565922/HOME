// js-call.js - WebRTC Calling Logic with Firebase

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const callModal = document.getElementById('call-interface-modal');
const incomingCallModal = document.getElementById('incoming-call-modal');
const callStatus = document.getElementById('call-status');
const callPartnerName = document.getElementById('call-partner-name');

let localStream;
let peerConnection;
let currentCallRef;
let incomingCallData = null;

// STUN Servers (ফ্রি গুগল সার্ভার - কানেকশনের জন্য জরুরি)
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

// 1. কল শুরু করার ফাংশন (Start Call)
async function startCall(isVideo) {
    const friendId = currentChatId; // js-chat.js থেকে বর্তমান চ্যাট আইডি
    if (!friendId) return alert("Select a friend first!");

    try {
        // নিজের ক্যামেরা/মাইক চালু করা
        localStream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
        localVideo.srcObject = localStream;
        
        // UI আপডেট
        document.getElementById('call-modal').classList.remove('hidden'); // তোমার HTML এ আইডি যদি ভিন্ন হয় ঠিক করে নিও
        callModal.classList.remove('hidden');
        callPartnerName.textContent = document.getElementById('chat-header-name').textContent;
        callStatus.textContent = "Calling...";

        // Peer Connection তৈরি
        createPeerConnection(friendId);

        // Offer তৈরি করা
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Firebase এ কল রিকোয়েস্ট পাঠানো
        const callId = db.ref('calls').push().key;
        currentCallRef = db.ref(`calls/${friendId}/${callId}`);
        
        await currentCallRef.set({
            callerId: currentUser.uid,
            callerName: document.getElementById('profile-view-name').textContent, // নিজের নাম
            type: 'offer',
            isVideo: isVideo,
            sdp: JSON.stringify(peerConnection.localDescription)
        });

        // সিগন্যালিং শোনা (Call Answered?)
        listenForAnswer(friendId, callId);

    } catch (error) {
        console.error("Error starting call:", error);
        alert("Could not start call. Check camera permissions.");
        endCall();
    }
}

// 2. Peer Connection সেটআপ
function createPeerConnection(partnerId) {
    peerConnection = new RTCPeerConnection(servers);

    // স্ট্রিম যোগ করা
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // রিমোট স্ট্রিম রিসিভ করা
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach(track => {
            remoteVideo.srcObject = event.streams[0];
        });
    };

    // ICE Candidate হ্যান্ডেল করা (নেটওয়ার্ক রুট খোঁজা)
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
         endCallUI();
    });
}

function showIncomingCallUI(name, isVideo) {
    document.getElementById('incoming-caller-name').textContent = name;
    incomingCallModal.classList.remove('hidden');
    // রিংটোন বাজাতে পারো এখানে
}

function hideIncomingCallUI() {
    incomingCallModal.classList.add('hidden');
}

// 4. কল রিসিভ করা (Answer Call)
document.getElementById('accept-call-btn').addEventListener('click', async () => {
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
        
        // ICE Candidate পাঠানো
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // যাকে কল করছি তার নোডে ক্যান্ডিডেট পাঠাবো? না, নিজের নোডেই সেভ করি, সে শুনে নেবে
                // WebRTC তে সিগন্যালিং একটু ট্রিকি। সহজ উপায় হলো:
                // যে কল রিসিভ করছে সে ক্যান্ডিডেট পাঠাবে caller এর কাছে।
                db.ref(`calls/${incomingCallData.callerId}/${incomingCallData.key}/candidates`).push(JSON.stringify(event.candidate));
            }
        };
        
        // Caller এর ক্যান্ডিডেট শোনা
        currentCallRef.child('candidates').on('child_added', (snapshot) => {
             const candidate = JSON.parse(snapshot.val());
             peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        });

    } catch (e) {
        console.error(e);
        endCall();
    }
});

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
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });
}

// 6. কল কেটে দেওয়া (End Call)
function endCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    
    callModal.classList.add('hidden');
    incomingCallModal.classList.add('hidden');
    
    // Firebase থেকে ডাটা ডিলিট (অপশনাল, ক্লিনআপের জন্য ভালো)
    if (currentCallRef) currentCallRef.remove();
    
    peerConnection = null;
    localStream = null;
    currentCallRef = null;
}

// বাটন ইভেন্ট লিসেনার
document.getElementById('header-video-call-btn').addEventListener('click', () => startCall(true));
document.getElementById('header-audio-call-btn').addEventListener('click', () => startCall(false));
// মোডাল বাটন
document.getElementById('modal-video-call-btn').addEventListener('click', () => {
    document.getElementById('partner-profile-modal').classList.add('hidden');
    startCall(true);
});
document.getElementById('modal-audio-call-btn').addEventListener('click', () => {
    document.getElementById('partner-profile-modal').classList.add('hidden');
    startCall(false);
});

document.getElementById('end-call-btn').addEventListener('click', endCall);
document.getElementById('reject-call-btn').addEventListener('click', () => {
    hideIncomingCallUI();
    if(incomingCallData) {
        db.ref(`calls/${currentUser.uid}/${incomingCallData.key}`).remove();
    }
});

// লগইন হওয়ার পর ইনকামিং কল লিসেনার চালু করা
// এই ফাংশনটি js-auth.js এর লগইন সাকসেস অংশে কল করতে হবে অথবা এখানে চেক করতে হবে
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        listenForIncomingCalls();
    }
});