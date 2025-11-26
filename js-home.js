const homeContent = document.getElementById('home-content');
const callsContent = document.getElementById('calls-content');
const allContentPanels = document.querySelectorAll('.content-panel');
const allNavTabs = document.querySelectorAll('.nav-tab');
const chatsBadge = document.getElementById('chats-badge');
const addFriendBtn = document.getElementById('add-friend-btn');
const addFriendForm = document.getElementById('add-friend-form');
const friendIdInput = document.getElementById('friend-id-input');
const notificationView = document.getElementById('notification-view');
const notificationBtn = document.getElementById('notification-btn');
const notificationListContent = document.getElementById('notification-list-content');
const notificationBackBtn = document.getElementById('notification-back-btn');
const supportFabBtn = document.getElementById('support-fab-btn');
const supportView = document.getElementById('support-view');
const supportBackBtn = document.getElementById('support-back-btn');
const supportMessages = document.getElementById('support-messages');
const supportInput = document.getElementById('support-input');
const supportSendBtn = document.getElementById('support-send-btn');
const customAlertBtnOk = document.getElementById('custom-alert-btn-ok');
const customConfirmBtnYes = document.getElementById('custom-confirm-btn-yes');
const customConfirmBtnNo = document.getElementById('custom-confirm-btn-no');
const verifiedInfoModal = document.getElementById('verified-info-modal');
const verifiedInfoBtnOk = document.getElementById('verified-info-btn-ok');

function showPanel(id) {
    allContentPanels.forEach(p => p.classList.toggle('active', p.id === id));
    allNavTabs.forEach(t => t.classList.toggle('active', t.id === `nav-${id.split('-')[0]}`));
}

allNavTabs.forEach(t => { t.addEventListener('click', () => { showPanel(t.id.split('-')[1] + '-content'); history.pushState(null, '', window.location.pathname); }); });

function createOrUpdateContactItem(contact, isFriendList = false) {
    const listContainer = isFriendList ? callsContent : homeContent;
    const existingItem = listContainer.querySelector(`.list-item[data-uid="${contact.uid}"]`);
    if (!isFriendList && currentUserData.blockedUsers && currentUserData.blockedUsers[contact.uid]) { if (existingItem) existingItem.remove(); return; }
    
    const lastMsgData = lastMessageTimestamps[contact.uid] || { text: 'Tap to chat', timestamp: 0 };
    if (existingItem) {
        existingItem.querySelector('.item-emoji').innerHTML = getProfilePicHTML(contact);
        existingItem.querySelector('.item-name-text').textContent = contact.name;
        const badgeContainer = existingItem.querySelector('.item-name.name-with-badge');
        if (badgeContainer.querySelector('.verified-badge')) badgeContainer.querySelector('.verified-badge').remove();
        badgeContainer.insertAdjacentHTML('beforeend', getVerifiedBadgeHTML(contact));
        if (!isFriendList) {
            existingItem.querySelector('.item-subtext').textContent = lastMsgData.text;
            existingItem.classList.toggle('hidden', lastMsgData.timestamp === 0);
        }
    } else {
        const item = document.createElement('div'); item.className = 'list-item';
        if (!isFriendList && lastMsgData.timestamp === 0) item.classList.add('hidden');
        item.dataset.uid = contact.uid;
        let itemHTML = `<div class="item-emoji">${getProfilePicHTML(contact)}</div><div class="item-details"><div class="item-name name-with-badge"><span class="item-name-text">${contact.name}</span>${getVerifiedBadgeHTML(contact)}</div>`;
        if (isFriendList) itemHTML += `</div>`; else itemHTML += `<div class="item-subtext" id="subtext-${contact.uid}">${lastMsgData.text}</div></div><div class="item-actions"><span class="badge hidden" id="badge-${contact.uid}"></span></div>`;
        item.innerHTML = itemHTML + '</div>';
        item.addEventListener('click', (e) => { if (e.target.closest('.verified-badge')) return; openChat(contact); }); // openChat in js-chat.js
        listContainer.appendChild(item);
    }
    if (!isFriendList) sortChatList();
}

function sortChatList() {
    const items = Array.from(homeContent.querySelectorAll('.list-item'));
    items.sort((a, b) => {
        const ta = (lastMessageTimestamps[a.dataset.uid] || {}).timestamp || 0;
        const tb = (lastMessageTimestamps[b.dataset.uid] || {}).timestamp || 0;
        return tb - ta;
    });
    items.forEach(i => homeContent.appendChild(i));
    const vis = items.filter(i => !i.classList.contains('hidden'));
    let msg = homeContent.querySelector('#no-chats-message');
    if (vis.length === 0) { if (!msg) { msg = document.createElement('p'); msg.id = 'no-chats-message'; msg.style.cssText = 'padding:20px;text-align:center;color:var(--wa-text-secondary);'; msg.textContent = 'No active chats.'; homeContent.appendChild(msg); } }
    else if (msg) msg.remove();
}

function listenForLastMessageUpdates(cid) {
    if (currentUserData.blockedUsers && currentUserData.blockedUsers[cid]) return;
    const ref = db.ref('messages/' + getChatId(currentUser.uid, cid)).limitToLast(1);
    if (contactListeners[cid + '_msg']) contactListeners[cid + '_msg'].off(); contactListeners[cid + '_msg'] = ref;
    ref.on('child_added', s => {
        const m = s.val(); if (currentUserData.blockedUsers && currentUserData.blockedUsers[m.senderId]) return;
        let previewText = '';
        if (m.type === 'audio') previewText = '🎤 Voice Message';
        else if (m.type === 'image') previewText = '📷 Photo';
        else if (m.type === 'video') previewText = '🎥 Video';
        else previewText = m.text;

        lastMessageTimestamps[cid] = { text: (m.senderId === currentUser.uid ? 'You: ' : '') + previewText, timestamp: m.timestamp };
        const i = homeContent.querySelector(`.list-item[data-uid="${cid}"]`);
        if (i) { i.querySelector('.item-subtext').textContent = lastMessageTimestamps[cid].text; i.classList.remove('hidden'); sortChatList(); }
    });
    ref.on('child_removed', () => {
        db.ref('messages/' + getChatId(currentUser.uid, cid)).limitToLast(1).once('value', s => {
            const i = homeContent.querySelector(`.list-item[data-uid="${cid}"]`); if (!i) return;
            if (s.exists()) {
                s.forEach(c => {
                    const m = c.val();
                    let previewText = '';
                    if (m.type === 'audio') previewText = '🎤 Voice Message';
                    else if (m.type === 'image') previewText = '📷 Photo';
                    else if (m.type === 'video') previewText = '🎥 Video';
                    else previewText = m.text;
                    lastMessageTimestamps[cid] = { text: (m.senderId === currentUser.uid ? 'You: ' : '') + previewText, timestamp: m.timestamp }; i.querySelector('.item-subtext').textContent = lastMessageTimestamps[cid].text;
                });
            } else { lastMessageTimestamps[cid] = { text: 'Tap to chat', timestamp: 0 }; i.querySelector('.item-subtext').textContent = 'Tap to chat'; i.classList.add('hidden'); }
            sortChatList();
        });
    });
}

function listenForContacts() {
    if (contactListeners.main) contactListeners.main.off();
    const r = db.ref('contacts/' + currentUser.uid); contactListeners.main = r;
    r.on('child_added', s => {
        const id = s.key; if (currentUserData.blockedUsers && currentUserData.blockedUsers[id]) return;
        const ur = db.ref('users/' + id); if (contactListeners[id + '_user']) contactListeners[id + '_user'].off();
        contactListeners[id + '_user'] = ur; ur.on('value', sn => { if (sn.exists()) createOrUpdateContactItem(sn.val()); });
        listenForLastMessageUpdates(id);
    });
    r.on('child_removed', s => { const id = s.key; if (contactListeners[id + '_user']) contactListeners[id + '_user'].off(); if (contactListeners[id + '_msg']) contactListeners[id + '_msg'].off(); const i = homeContent.querySelector(`.list-item[data-uid="${id}"]`); if (i) i.remove(); delete lastMessageTimestamps[id]; sortChatList(); });
}

async function populateAllFriendsList() {
    if (!callsContent || !currentUser) return; callsContent.innerHTML = '';
    try {
        const snap = await db.ref('contacts/' + currentUser.uid).once('value');
        if (!snap.exists()) { callsContent.innerHTML = '<p style="padding:20px;text-align:center;color:var(--wa-text-secondary);">No friends found.</p>'; return; }
        const uids = Object.keys(snap.val()), snaps = await Promise.all(uids.map(u => currentUserData.blockedUsers && currentUserData.blockedUsers[u] ? null : db.ref('users/' + u).once('value')).filter(p => p !== null));
        const friends = snaps.filter(s => s.exists()).map(s => s.val()).sort((a, b) => a.name.localeCompare(b.name));
        friends.forEach(f => createOrUpdateContactItem(f, true));
        if (friends.length === 0) callsContent.innerHTML = '<p style="padding:20px;text-align:center;color:var(--wa-text-secondary);">No friends found.</p>';
    } catch (e) { callsContent.innerHTML = '<p style="padding:20px;text-align:center;color:var(--call-end-red);">Error.</p>'; }
}

addFriendBtn.addEventListener('click', () => { addFriendForm.reset(); showModal('add-friend-modal'); history.pushState(null, '', window.location.pathname); });

addFriendForm.addEventListener('submit', e => {
    e.preventDefault(); const fid = friendIdInput.value.trim();
    if (fid === currentUser.uid) { showNotification("Cannot add yourself."); return; }
    db.ref('users/' + fid).once('value', s => {
        if (s.exists()) {
            if (currentUserData.blockedUsers && currentUserData.blockedUsers[fid]) { showNotification("User blocked."); return; }
            const u = {}; u[`contacts/${currentUser.uid}/${fid}`] = true; u[`contacts/${fid}/${currentUser.uid}`] = true;
            db.ref().update(u).then(() => { showNotification('Friend added!'); showModal('add-friend-modal', false); if (history.state) history.back(); populateAllFriendsList(); });
        } else showNotification('User not found.');
    });
});

function listenForUnreadCounts() {
    const ur = db.ref('unreadCounts/' + currentUser.uid); if (unreadListeners.main) unreadListeners.main.off();
    ur.on('value', s => {
        let tot = 0; const c = s.val() || {}, blk = currentUserData.blockedUsers || {};
        document.querySelectorAll('.list-item').forEach(i => {
            const uid = i.dataset.uid; if (uid && !blk[uid]) { const cnt = c[uid] || 0; const b = document.getElementById(`badge-${uid}`); if (b) { b.textContent = cnt; b.classList.toggle('hidden', cnt === 0); } tot += cnt; }
        });
        chatsBadge.textContent = tot; chatsBadge.classList.toggle('hidden', tot === 0);
    });
    unreadListeners.main = ur;
}

// Notifications
function updateNotificationBadge() { notificationBadge.textContent = unreadNotificationCount; notificationBadge.classList.toggle('hidden', unreadNotificationCount === 0); }
function listenForNotifications() {
    if (notificationListener) notificationListener.off(); if (!currentUser) return;
    const nr = db.ref('notifications/' + currentUser.uid); notificationListener = nr.orderByChild('timestamp').limitToLast(30);
    notificationListContent.innerHTML = ''; unreadNotificationCount = 0;
    notificationListener.on('child_added', s => {
        const n = s.val(), id = s.key; if (document.getElementById(id)) return;
        const i = document.createElement('div'); i.className = 'notification-item'; i.id = id;
        i.innerHTML = `<div class="notification-item-text">${n.message}</div><div class="notification-item-time">${formatFullTimestamp(n.timestamp)}</div>`;
        const delBtn = document.createElement('button'); delBtn.className = 'notif-delete-btn'; delBtn.innerHTML = '&times;';
        delBtn.addEventListener('click', e => { e.stopPropagation(); customConfirm('Delete notification?').then(y => { if (y) db.ref(`notifications/${currentUser.uid}/${id}`).remove(); }); });
        i.appendChild(delBtn);
        const nm = notificationListContent.querySelector('#no-notifications-msg'); if (nm) nm.remove(); notificationListContent.prepend(i);
        if (!n.read) { unreadNotificationCount++; updateNotificationBadge(); }
    });
    notificationListener.on('child_removed', s => { const el = document.getElementById(s.key); if (el) el.remove(); if (!notificationListContent.children.length) notificationListContent.innerHTML = '<p id="no-notifications-msg">No notifications.</p>'; });
}

notificationBtn.addEventListener('click', () => {
    showView('notification-view'); history.pushState(null, '', window.location.pathname);
    if (unreadNotificationCount > 0 && currentUser) {
        const r = db.ref('notifications/' + currentUser.uid); r.orderByChild('read').equalTo(false).once('value', s => { const u = {}; s.forEach(c => { u[c.key + '/read'] = true; }); if (Object.keys(u).length) r.update(u); });
    }
    unreadNotificationCount = 0; updateNotificationBadge();
});
notificationBackBtn.addEventListener('click', () => { showView('main-view'); });

// Support
supportFabBtn.addEventListener('click', () => { showView('support-view'); history.pushState(null, '', window.location.pathname); listenForSupportMessages(); });
supportBackBtn.addEventListener('click', () => { showView('main-view'); if (supportListener) supportListener.off(); supportListener = null; });
supportSendBtn.addEventListener('click', () => {
    const t = supportInput.value.trim(); if (!t || !currentUser) return;
    db.ref(`support_chats/${currentUser.uid}`).push({ text: t, sender: 'user', timestamp: firebase.database.ServerValue.TIMESTAMP });
    db.ref('support_requests').push({ uid: currentUser.uid, message: t, timestamp: firebase.database.ServerValue.TIMESTAMP }).then(() => { supportInput.value = ''; supportMessages.scrollTop = supportMessages.scrollHeight; });
});
function listenForSupportMessages() {
    if (!currentUser) return; if (supportListener) supportListener.off(); supportMessages.innerHTML = '';
    supportListener = db.ref(`support_chats/${currentUser.uid}`).on('child_added', s => {
        const m = s.val(); const b = document.createElement('div'); b.className = `support-bubble ${m.sender === 'user' ? 'sent' : 'received'}`; b.textContent = m.text; supportMessages.appendChild(b); supportMessages.scrollTop = supportMessages.scrollHeight;
    });
}

// Modal & Back Button Logic
function handleCustomBack() {
    if (!verifiedInfoModal.classList.contains('hidden')) { verifiedInfoBtnOk.click(); return true; }
    if (!document.getElementById('message-options-modal').classList.contains('hidden')) { showModal('message-options-modal', false); return true; }
    if (!document.getElementById('custom-alert-modal').classList.contains('hidden')) { customAlertBtnOk.click(); return true; }
    if (!document.getElementById('custom-confirm-modal').classList.contains('hidden')) { customConfirmBtnNo.click(); return true; }
    if (!document.getElementById('partner-profile-modal').classList.contains('hidden')) { showModal('partner-profile-modal', false); return true; }
    if (!document.getElementById('profile-view-modal').classList.contains('hidden')) { showModal('profile-view-modal', false); return true; }
    if (!document.getElementById('add-friend-modal').classList.contains('hidden')) { showModal('add-friend-modal', false); return true; }
    if (!document.getElementById('media-view-modal').classList.contains('hidden')) { document.getElementById('close-media-btn').click(); return true; }
    if (!document.getElementById('pin-setup-modal').classList.contains('hidden')) return true;
    if (!notificationView.classList.contains('hidden')) { notificationBackBtn.click(); return true; }
    if (!supportView.classList.contains('hidden')) { supportBackBtn.click(); return true; }
    if (!document.getElementById('chat-view').classList.contains('hidden')) { showView('main-view'); currentChatPartner = null; if (currentChatListener) currentChatListener.off(); resetChatInputUI(); return true; }
    if (!document.getElementById('main-view').classList.contains('hidden')) { if (!homeContent.classList.contains('active')) { showPanel('home-content'); return true; } else { showView('calculator-lock-view'); isAppUnlocked = false; return true; } }
    if (!document.getElementById('calculator-lock-view').classList.contains('hidden')) { auth.signOut(); return true; }
    return false;
}

window.addEventListener('popstate', () => { if (handleCustomBack()) history.pushState(null, '', window.location.pathname); });
history.pushState(null, '', window.location.pathname);

// Listeners for Modal buttons (Moved from inline to here for modularity)
customConfirmBtnYes.addEventListener('click', () => { if (customConfirmResolver) customConfirmResolver(true); showModal('custom-confirm-modal', false); if (history.state) history.back(); });
customConfirmBtnNo.addEventListener('click', () => { if (customConfirmResolver) customConfirmResolver(false); showModal('custom-confirm-modal', false); if (history.state) history.back(); });
customAlertBtnOk.addEventListener('click', () => { showModal('custom-alert-modal', false); if (history.state) history.back(); });
verifiedInfoBtnOk.addEventListener('click', () => { showModal('verified-info-modal', false); if (history.state) history.back(); });
document.addEventListener('click', e => { if (e.target.closest('.verified-badge')) { e.stopPropagation(); showModal('verified-info-modal'); history.pushState(null, '', window.location.pathname); } });
document.querySelectorAll('.close-modal-btn').forEach(btn => { btn.addEventListener('click', e => { const m = e.target.closest('.modal'); if (m) { showModal(m.id, false); if (history.state) history.back(); } }); });

// Custom Prompt
const customPromptForm = document.getElementById('custom-prompt-form');
const promptInput = document.getElementById('prompt-input');
function customPrompt(title, val = '') { return new Promise(resolve => { customPromptResolver = resolve; document.getElementById('prompt-modal-title').textContent = title; promptInput.value = val; showModal('custom-prompt-modal'); history.pushState(null, '', window.location.pathname); }); }
customPromptForm.addEventListener('submit', e => { e.preventDefault(); if (customPromptResolver) customPromptResolver(promptInput.value); showModal('custom-prompt-modal', false); if (history.state) history.back(); });

function cleanupListeners() {
    if (currentChatListener) currentChatListener.off();
    if (notificationListener) notificationListener.off();
    if (supportListener) supportListener.off();
    if (contactListeners.currentUser) contactListeners.currentUser.off();
    Object.values(unreadListeners).forEach(l => l && l.off());
    Object.values(contactListeners).forEach(l => l && l.off());
    unreadListeners = {}; contactListeners = {}; lastMessageTimestamps = {}; messageElements = {};
}