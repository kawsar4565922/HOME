const chatHeaderPicWrapper = document.getElementById('chat-header-pic-wrapper');
const chatHeaderName = document.getElementById('chat-header-name');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');
const chatBackBtn = document.getElementById('chat-back-btn');
const voiceRecordBtn = document.getElementById('voice-record-btn');
const recordingUi = document.getElementById('recording-ui');
const recordingTimer = document.getElementById('recording-timer');
const cancelRecordingBtn = document.getElementById('cancel-recording-btn');
const chatInputContainer = document.getElementById('chat-input-container');
const audioPreviewContainer = document.getElementById('audio-preview-container');
const deleteRecordingBtn = document.getElementById('delete-recording-btn');
const previewAudioPlayer = document.getElementById('preview-audio-player');
const attachMediaBtn = document.getElementById('attach-media-btn');
const mediaFileInput = document.getElementById('media-file-input');
const mediaViewModal = document.getElementById('media-view-modal');
const mediaContentDisplay = document.getElementById('media-content-display');
const closeMediaBtn = document.getElementById('close-media-btn');
const modalDownloadBtn = document.getElementById('modal-download-btn');
const messageOptionsModal = document.getElementById('message-options-modal');
const msgOptCopy = document.getElementById('msg-opt-copy');
const msgOptDeleteMe = document.getElementById('msg-opt-delete-me');
const msgOptDeleteEveryone = document.getElementById('msg-opt-delete-everyone');
const msgOptCancel = document.getElementById('msg-opt-cancel');

function openChat(p) {
    currentChatPartner = p;
    chatHeaderPicWrapper.innerHTML = getProfilePicHTML(p, '1.8rem');
    chatHeaderName.innerHTML = `<span class="item-name-text">${p.name}</span>${getVerifiedBadgeHTML(p)}`;
    chatMessages.innerHTML = ''; messageElements = {};
    showView('chat-view'); history.pushState(null, '', window.location.pathname);
    db.ref(`unreadCounts/${currentUser.uid}/${p.uid}`).remove();
    if (currentChatListener) currentChatListener.off();
    const ref = db.ref('messages/' + getChatId(currentUser.uid, p.uid));
    currentChatListener = ref.limitToLast(50);
    currentChatListener.on('child_added', s => {
        const m = s.val(); if (currentUserData.blockedUsers && currentUserData.blockedUsers[m.senderId]) return;
        renderMessage(s.key, m); if (m.receiverId === currentUser.uid && m.status !== 'seen') ref.child(s.key).update({ status: 'seen' });
    });
    currentChatListener.on('child_changed', s => { if (s.val().senderId === currentUser.uid && messageElements[s.key]) document.getElementById(`status-${s.key}`).innerHTML = getStatusSVG(s.val().status); });
    currentChatListener.on('child_removed', s => { if (messageElements[s.key]) { messageElements[s.key].remove(); delete messageElements[s.key]; } });
}

function getStatusSVG(s) {
    if (s === 'sending') return `<svg class="message-status-icon sending" viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm4.2 14.2L11 13V7h1.5v5.2l4.5 2.7-.8 1.3z"/></svg>`;
    const seen = s === 'seen';
    return `<svg class="message-status-icon ${seen ? 'seen' : ''}" viewBox="0 0 24 24" fill="${seen ? 'var(--wa-accent-blue)' : 'var(--wa-text-secondary)'}"><path d="${seen ? 'M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z' : 'M9.01 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 13.4l7-7z'}"/></svg>`;
}

async function downloadMedia(url, type) {
    showNotification("Downloading...");
    try {
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `secret_media_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (e) {
        showNotification("Download failed. Opening in new tab...");
        window.open(url, '_blank');
    }
}

function renderMessage(mid, m) {
    const isMe = m.senderId === currentUser.uid;
    const hidden = JSON.parse(localStorage.getItem(`hidden_msgs_${currentUser.uid}`)) || [];
    if (hidden.includes(mid) || messageElements[mid]) return;
    const b = document.createElement('div'); b.className = `message-bubble ${isMe ? 'message-sent' : 'message-received'}`; b.id = `msg-${mid}`;

    if (m.status === 'sending') b.style.opacity = '0.8';

    let pt; const sp = () => { pt = setTimeout(() => { openMessageOptions(mid, m.text, isMe); }, 600); }, cp = () => { clearTimeout(pt); };
    b.addEventListener('mousedown', sp); b.addEventListener('mouseup', cp); b.addEventListener('mouseleave', cp); b.addEventListener('touchstart', sp); b.addEventListener('touchend', cp); b.addEventListener('touchmove', cp);
    const cw = document.createElement('div'); cw.className = 'message-content-wrapper';

    if (m.type === 'audio') {
        const aud = document.createElement('audio'); aud.controls = true; aud.className = 'audio-player'; aud.src = m.content; cw.appendChild(aud);
    }
    else if (m.type === 'image' || m.type === 'video') {
        const d = document.createElement('div'); d.className = 'media-bubble';
        let iconSvg = '';
        if (m.type === 'image') iconSvg = '<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:var(--wa-text-primary);"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        else iconSvg = '<svg viewBox="0 0 24 24" style="width:24px;height:24px;fill:var(--wa-text-primary);"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>';
        let label = m.type === 'image' ? '📷 Photo' : '🎥 Video';
        d.innerHTML = `${iconSvg}<span class="media-text">${label}</span>`;
        d.addEventListener('click', () => {
            currentViewingMsgId = mid; currentMediaUrl = m.content; currentMediaType = m.type;
            if (isMe) modalDownloadBtn.style.display = 'none'; else modalDownloadBtn.style.display = 'flex';
            mediaViewModal.classList.remove('hidden'); mediaContentDisplay.innerHTML = '';
            if (m.type === 'image') {
                const el = document.createElement('img'); el.src = m.content; el.style.cssText = 'max-width:100%;max-height:100%;object-fit:contain;'; mediaContentDisplay.appendChild(el);
            } else {
                const el = document.createElement('video'); el.src = m.content; el.controls = true; el.autoplay = true; el.style.cssText = 'max-width:100%;max-height:100%;'; el.onended = () => closeMediaBtn.click(); mediaContentDisplay.appendChild(el);
            }
        });
        cw.appendChild(d);
    }
    else {
        const t = document.createElement('span'); t.className = 'message-text'; t.textContent = m.text; cw.appendChild(t);
    }

    const tw = document.createElement('div'); tw.className = 'message-time-status';
    const ts = document.createElement('span'); ts.textContent = formatTimestamp(m.timestamp); tw.appendChild(ts);
    if (isMe) { const si = document.createElement('span'); si.id = `status-${mid}`; si.innerHTML = getStatusSVG(m.status || 'sent'); tw.appendChild(si); }
    cw.appendChild(tw); b.appendChild(cw); chatMessages.appendChild(b); messageElements[mid] = b;
    if (chatMessages.scrollHeight - chatMessages.clientHeight <= chatMessages.scrollTop + 100) chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage() {
    if (!currentChatPartner) return;
    if (isRecording) { sendImmediately = true; stopRecording(true); return; }
    if (currentAudioBlob) { handleMediaSend(currentAudioBlob, 'audio'); currentAudioBlob = null; resetChatInputUI(); return; }
    const t = chatInput.value.trim(); if (!t) return;
    const msgData = { text: t, senderId: currentUser.uid, receiverId: currentChatPartner.uid, timestamp: firebase.database.ServerValue.TIMESTAMP, status: 'sending' };
    const pushRef = db.ref('messages/' + getChatId(currentUser.uid, currentChatPartner.uid)).push(msgData);
    pushRef.then(() => { pushRef.update({ status: 'sent' }); });
    db.ref(`unreadCounts/${currentChatPartner.uid}/${currentUser.uid}`).transaction(c => (c || 0) + 1);
    chatInput.value = ''; chatInput.focus();
}
chatSendBtn.addEventListener('click', sendMessage);
chatBackBtn.addEventListener('click', () => { showView('main-view'); currentChatPartner = null; if (currentChatListener) currentChatListener.off(); resetChatInputUI(); });

// Voice Recording Logic
async function startRecording() {
    try {
        currentAudioBlob = null; isRecordingSaved = false; sendImmediately = false;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream); audioChunks = []; isRecording = true;
        chatInputContainer.classList.add('recording'); recordingUi.classList.remove('hidden'); audioPreviewContainer.classList.add('hidden');
        voiceRecordBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
        let seconds = 0; recordingTimer.textContent = "00:00";
        recordingTimerInterval = setInterval(() => { seconds++; const m = Math.floor(seconds / 60), s = seconds % 60; recordingTimer.textContent = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`; }, 1000);
        mediaRecorder.addEventListener("dataavailable", e => { audioChunks.push(e.data); });
        mediaRecorder.addEventListener("stop", () => {
            stream.getTracks().forEach(t => t.stop());
            if (isRecordingSaved) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm;codecs=opus' });
                currentAudioBlob = audioBlob;
                if (sendImmediately) { sendImmediately = false; handleMediaSend(audioBlob, 'audio'); currentAudioBlob = null; resetChatInputUI(); }
                else { showAudioPreviewUI(audioBlob); }
            }
        });
        mediaRecorder.start();
    } catch (error) { showNotification("Mic error: " + error.message); }
}
function stopRecording(save) {
    if (!mediaRecorder || !isRecording) return;
    isRecordingSaved = save; mediaRecorder.stop(); isRecording = false; clearInterval(recordingTimerInterval);
    if (!save) resetChatInputUI();
}
voiceRecordBtn.addEventListener('click', async () => { if (!isRecording) startRecording(); else stopRecording(true); });
cancelRecordingBtn.addEventListener('click', () => { stopRecording(false); });
deleteRecordingBtn.addEventListener('click', () => { currentAudioBlob = null; resetChatInputUI(); });

function showAudioPreviewUI(blob) {
    chatInputContainer.classList.remove('recording'); recordingUi.classList.add('hidden'); chatInput.style.display = 'none'; voiceRecordBtn.classList.add('hidden'); attachMediaBtn.classList.add('hidden'); audioPreviewContainer.classList.remove('hidden');
    const audioUrl = URL.createObjectURL(blob); previewAudioPlayer.src = audioUrl;
}
function resetChatInputUI() {
    chatInputContainer.classList.remove('recording'); recordingUi.classList.add('hidden'); audioPreviewContainer.classList.add('hidden'); chatInput.style.display = 'block'; voiceRecordBtn.classList.remove('hidden'); attachMediaBtn.classList.remove('hidden'); chatInput.value = '';
    voiceRecordBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>';
}

// Media Sending
attachMediaBtn.addEventListener('click', () => { mediaFileInput.click(); });
mediaFileInput.addEventListener('change', async function (e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 100 * 1024 * 1024) { showNotification("File too large! Max 100MB allowed."); this.value = ''; return; }
    const msgType = file.type.startsWith('image/') ? 'image' : 'video';
    handleMediaSend(file, msgType); this.value = '';
});

function handleMediaSend(fileOrBlob, type) {
    if (!currentChatPartner) return;
    const tempId = 'temp_' + Date.now();
    const blobUrl = URL.createObjectURL(fileOrBlob);
    const chatId = getChatId(currentUser.uid, currentChatPartner.uid);
    let textLabel = '';
    if (type === 'audio') textLabel = '🎤 Voice Message'; else if (type === 'image') textLabel = '📷 Photo'; else if (type === 'video') textLabel = '🎥 Video';
    const tempMsg = { text: textLabel, type: type, content: blobUrl, senderId: currentUser.uid, receiverId: currentChatPartner.uid, timestamp: Date.now(), status: 'sending' };
    renderMessage(tempId, tempMsg);
    const resourceType = (type === 'audio' || type === 'video') ? 'video' : 'image';
    uploadToCloudinary(fileOrBlob, resourceType).then(url => {
        if (url) {
            const dbMsg = { ...tempMsg, content: url, status: 'sent' }; dbMsg.timestamp = firebase.database.ServerValue.TIMESTAMP;
            db.ref('messages/' + chatId).push(dbMsg);
            db.ref(`unreadCounts/${currentChatPartner.uid}/${currentUser.uid}`).transaction(count => (count || 0) + 1);
            const tempEl = document.getElementById('msg-' + tempId); if (tempEl) tempEl.remove(); delete messageElements[tempId];
        } else {
            showNotification("Failed to send media.");
            const tempEl = document.getElementById('msg-' + tempId); if (tempEl) tempEl.style.opacity = '0.5';
        }
    });
}
closeMediaBtn.addEventListener('click', () => { mediaViewModal.classList.add('hidden'); mediaContentDisplay.innerHTML = ''; currentViewingMsgId = null; currentMediaUrl = null; currentMediaType = null; });
modalDownloadBtn.addEventListener('click', () => { if (currentMediaUrl && currentMediaType) { downloadMedia(currentMediaUrl, currentMediaType); } });

// Message Options
function openMessageOptions(mid, txt, isMe) {
    currentSelectedMsgId = mid; currentSelectedMsgText = txt; currentSelectedMsgIsSender = isMe;
    msgOptDeleteEveryone.classList.toggle('hidden', !isMe); showModal('message-options-modal'); history.pushState(null, '', window.location.pathname);
}
msgOptCopy.addEventListener('click', () => { copyText(currentSelectedMsgText, 'Message copied'); showModal('message-options-modal', false); if (history.state) history.back(); });
msgOptCancel.addEventListener('click', () => { showModal('message-options-modal', false); if (history.state) history.back(); });
msgOptDeleteMe.addEventListener('click', () => {
    if (!currentSelectedMsgId) return;
    const k = `hidden_msgs_${currentUser.uid}`; const h = JSON.parse(localStorage.getItem(k)) || []; h.push(currentSelectedMsgId); localStorage.setItem(k, JSON.stringify(h));
    const b = document.getElementById(`msg-${currentSelectedMsgId}`); if (b) b.remove(); delete messageElements[currentSelectedMsgId];
    showNotification('Deleted for you'); showModal('message-options-modal', false); if (history.state) history.back();
});
msgOptDeleteEveryone.addEventListener('click', () => {
    if (!currentSelectedMsgId || !currentChatPartner) return;
    db.ref(`messages/${getChatId(currentUser.uid, currentChatPartner.uid)}/${currentSelectedMsgId}`).remove().then(() => { showNotification('Deleted for everyone'); });
    showModal('message-options-modal', false); if (history.state) history.back();
});