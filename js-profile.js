const menuBtn = document.getElementById('menu-btn');
const profilePicWrapper = document.getElementById('profile-pic-wrapper');
const profileViewName = document.getElementById('profile-view-name');
const profileViewEmail = document.getElementById('profile-view-email');
const profileEditNameBtn = document.getElementById('profile-edit-name-btn');
const profileEditNameForm = document.getElementById('profile-edit-name-form');
const profileNameInput = document.getElementById('profile-name-input');
const profileSaveNameBtn = document.getElementById('profile-save-name-btn');
const profileUserIdText = document.getElementById('profile-user-id-text');
const profileUserEmailText = document.getElementById('profile-user-email-text');
const profileCopyIdBtn = document.getElementById('profile-copy-id-btn');
const profileCopyEmailBtn = document.getElementById('profile-copy-email-btn');
const blockedUsersListEl = document.getElementById('blocked-users-list');
const logoutBtn = document.getElementById('logout-btn');
const partnerModalName = document.getElementById('partner-modal-name');
const partnerModalIdText = document.getElementById('partner-modal-id-text');
const partnerModalCopyIdBtn = document.getElementById('partner-modal-copy-id-btn');
const partnerModalBlockBtn = document.getElementById('partner-modal-block-btn');
const partnerModalDeleteChatBtn = document.getElementById('partner-modal-delete-chat-btn');
const chatHeaderInfo = document.getElementById('chat-header-info');

menuBtn.addEventListener('click', () => {
    if (!currentUserData) return;
    profilePicWrapper.innerHTML = getProfilePicHTML(currentUserData, '4.5rem');
    profileViewName.innerHTML = `${currentUserData.name}${getVerifiedBadgeHTML(currentUserData)}`;
    profileViewEmail.textContent = currentUserData.email;
    profileUserIdText.textContent = currentUserData.uid;
    profileUserEmailText.textContent = currentUserData.email;
    profileEditNameForm.classList.add('hidden');
    profileViewName.classList.remove('hidden');
    profileEditNameBtn.classList.remove('hidden');
    populateBlockedUsersList();
    showModal('profile-view-modal');
    history.pushState(null, '', window.location.pathname);
});

profilePicWrapper.addEventListener('click', async () => {
    const fileInput = document.createElement('input'); fileInput.type = 'file'; fileInput.accept = 'image/*';
    fileInput.onchange = async (e) => {
        const file = e.target.files[0]; if (!file) return;
        showNotification("Uploading profile pic...");
        const url = await uploadToCloudinary(file, 'image');
        if (url) {
            db.ref(`users/${currentUser.uid}/profilePicUrl`).set(url)
                .then(() => { showNotification('Profile picture updated!'); })
                .catch(e => showNotification('Error: ' + e.message));
        }
    };
    fileInput.click();
});

profileEditNameBtn.addEventListener('click', () => { profileEditNameForm.classList.remove('hidden'); profileNameInput.value = currentUserData.name; profileViewName.classList.add('hidden'); profileEditNameBtn.classList.add('hidden'); });
profileSaveNameBtn.addEventListener('click', () => {
    const n = profileNameInput.value.trim();
    if (n && n !== currentUserData.name) { db.ref(`users/${currentUser.uid}/name`).set(n).then(() => { showNotification('Name updated!'); }).finally(() => { profileEditNameForm.classList.add('hidden'); profileViewName.classList.remove('hidden'); profileEditNameBtn.classList.remove('hidden'); }); }
    else { profileEditNameForm.classList.add('hidden'); profileViewName.classList.remove('hidden'); profileEditNameBtn.classList.remove('hidden'); }
});

profileCopyIdBtn.addEventListener('click', () => { copyText(currentUserData.uid, 'ID copied!'); });
profileCopyEmailBtn.addEventListener('click', () => { copyText(currentUserData.email, 'Email copied!'); });

logoutBtn.addEventListener('click', () => {
    appInitialized = false; isAppUnlocked = false;
    showModal('pin-setup-modal', false);
    auth.signOut();
    showModal('profile-view-modal', false);
});

function listenForBlockedUsers(uid) {
    const r = db.ref('blockedUsers/' + uid); if (contactListeners.blocked) contactListeners.blocked.off();
    r.on('value', s => {
        currentUserData.blockedUsers = s.val() || {};
        if (!document.getElementById('profile-view-modal').classList.contains('hidden')) populateBlockedUsersList();
        populateAllFriendsList(); // From js-home.js
    });
    contactListeners.blocked = r;
}

async function populateBlockedUsersList() {
    if (!blockedUsersListEl) return; blockedUsersListEl.innerHTML = 'Loading...';
    const blk = Object.keys(currentUserData.blockedUsers || {});
    if (!blk.length) { blockedUsersListEl.innerHTML = 'No users blocked.'; return; }
    blockedUsersListEl.innerHTML = '';
    for (const uid of blk) {
        const s = await db.ref('users/' + uid).once('value'), u = s.exists() ? s.val() : { name: uid };
        const d = document.createElement('div'); d.className = 'blocked-user-item';
        d.innerHTML = `<span class="name-with-badge"><span class="item-name-text">${u.name}</span>${getVerifiedBadgeHTML(u)}</span><button class="unblock-btn" data-uid="${uid}">Unblock</button>`;
        blockedUsersListEl.appendChild(d);
    }
}
blockedUsersListEl.addEventListener('click', e => { if (e.target.classList.contains('unblock-btn')) unblockUser(e.target.dataset.uid); });

function unblockUser(uid) {
    const u = {}; u[`blockedUsers/${currentUser.uid}/${uid}`] = null; u[`contacts/${currentUser.uid}/${uid}`] = true; u[`contacts/${uid}/${currentUser.uid}`] = true;
    db.ref().update(u).then(() => { showNotification('Unblocked.'); });
}

// Partner Profile Logic
chatHeaderInfo.addEventListener('click', e => {
    if (e.target.closest('.verified-badge')) return;
    if (currentChatPartner) {
        partnerModalName.innerHTML = `${currentChatPartner.name}${getVerifiedBadgeHTML(currentChatPartner)}`;
        partnerModalIdText.textContent = currentChatPartner.uid;
        showModal('partner-profile-modal');
        history.pushState(null, '', window.location.pathname);
    }
});
partnerModalCopyIdBtn.addEventListener('click', () => { if (currentChatPartner) copyText(currentChatPartner.uid, 'Friend ID copied!'); });

partnerModalBlockBtn.addEventListener('click', () => {
    if (currentChatPartner) customConfirm("Block user?").then(y => {
        if (y) {
            const uid = currentChatPartner.uid, u = {};
            u[`blockedUsers/${currentUser.uid}/${uid}`] = true; u[`contacts/${currentUser.uid}/${uid}`] = null; u[`contacts/${uid}/${currentUser.uid}`] = null; u[`messages/${getChatId(currentUser.uid, uid)}`] = null;
            db.ref().update(u).then(() => { showNotification('Blocked.'); showModal('partner-profile-modal', false); if (history.state) history.back(); document.getElementById('chat-back-btn').click(); });
        }
    });
});

function deleteChatHistory(pid) {
    const cid = getChatId(currentUser.uid, pid);
    const u = {}; u[`messages/${cid}`] = null; u[`unreadCounts/${currentUser.uid}/${pid}`] = null; u[`unreadCounts/${pid}/${currentUser.uid}`] = null;
    db.ref().update(u).then(() => {
        showNotification('Chat history removed.');
        const i = document.querySelector(`.list-item[data-uid="${pid}"]`);
        if (i) { lastMessageTimestamps[pid] = { text: 'Tap to chat', timestamp: 0 }; i.querySelector('.item-subtext').textContent = 'Tap to chat'; i.classList.add('hidden'); sortChatList(); }
    });
}

partnerModalDeleteChatBtn.addEventListener('click', () => {
    if (currentChatPartner) customConfirm("Delete chat history?").then(y => { if (y) { deleteChatHistory(currentChatPartner.uid); showModal('partner-profile-modal', false); if (history.state) history.back(); document.getElementById('chat-back-btn').click(); } });
});