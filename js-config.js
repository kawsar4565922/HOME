// ========= CLOUDINARY CONFIGURATION =========
const CLOUDINARY_CLOUD_NAME = 'dinorzrp4'; 
const CLOUDINARY_UPLOAD_PRESET = 'kcalculator07'; 
// ============================================

// Firebase Config & Init
const firebaseConfig = {
    apiKey: "AIzaSyBh7oN1SOlJvTdV4ld5JRP6wBRWu-DL_nQ",
    authDomain: "kawsar-messaging-apps.firebaseapp.com",
    databaseURL: "https://kawsar-messaging-apps-default-rtdb.firebaseio.com",
    projectId: "kawsar-messaging-apps",
    storageBucket: "kawsar-messaging-apps.firebasestorage.app",
    messagingSenderId: "738233086903",
    appId: "1:738233086903:web:9357e641d888c2f9a76e32",
    measurementId: "G-18N3ZJFVKW"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

// Global Variables
let currentUser = null, currentUserData = null, appInitialized = false, authStateInitialized = false, authStateResolve = null;
const authReadyPromise = new Promise(resolve => { authStateResolve = resolve; });
let userDataResolve = null;
const userDataReadyPromise = new Promise(resolve => { userDataResolve = resolve; });
let currentChatPartner = null, currentChatListener = null, unreadListeners = {}, contactListeners = {}, lastMessageTimestamps = {}, messageElements = {};
let customPromptResolver = null, customConfirmResolver = null, customAlertResolver = null;
let notificationListener = null, unreadNotificationCount = 0, supportListener = null;
let mediaRecorder = null, audioChunks = [], isRecording = false, recordingTimerInterval = null, autoStopTimeout = null;
let currentAudioBlob = null;
let isRecordingSaved = false;
let sendImmediately = false;
let currentSelectedMsgId = null, currentSelectedMsgText = null, currentSelectedMsgIsSender = false;
let currentViewingMsgId = null;
let currentMediaUrl = null;
let currentMediaType = null;

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(reg => console.log('SW Registered!', reg.scope))
      .catch(err => console.log('SW Failed:', err));
  });
}

// DOM Elements (Global Access)
const appContainer = document.getElementById('app-container');
const allViews = document.querySelectorAll('.view');
const allModals = document.querySelectorAll('.modal');
const notificationContainer = document.getElementById('notification-container');
const notificationBadge = document.getElementById('notification-badge');

// Global Helper Functions
function showView(viewId) {
    allViews.forEach(view => { view.classList.add('hidden'); });
    document.getElementById('calculator-lock-view').classList.add('hidden');
    
    if (viewId === 'calculator-lock-view') {
        document.getElementById('calculator-lock-view').classList.remove('hidden');
        resetCalculator(); // Function from js-lock.js
    }
    else if (viewId === 'main-view') document.getElementById('main-view').classList.remove('hidden');
    else if (viewId === 'auth-view') document.getElementById('auth-view').classList.remove('hidden');
    else if (viewId === 'chat-view') document.getElementById('chat-view').classList.remove('hidden');
    else if (viewId === 'notification-view') document.getElementById('notification-view').classList.remove('hidden');
    else if (viewId === 'support-view') document.getElementById('support-view').classList.remove('hidden');
}

function showModal(id, show = true) {
    const m = document.getElementById(id);
    if (m) m.classList.toggle('hidden', !show);
}

function showNotification(msg, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.textContent = msg;
    notificationContainer.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function showCustomAlert(msg) {
    document.getElementById('custom-alert-message').textContent = msg;
    showModal('custom-alert-modal');
    history.pushState(null, '', window.location.pathname);
}

function customConfirm(msg) {
    return new Promise(resolve => {
        customConfirmResolver = resolve;
        document.getElementById('custom-confirm-message').textContent = msg;
        showModal('custom-confirm-modal');
        history.pushState(null, '', window.location.pathname);
    });
}

function copyText(txt, msg) {
    if (!txt) return;
    const el = document.createElement('textarea');
    el.value = txt;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showNotification(msg);
}

function getChatId(u1, u2) {
    return u1 < u2 ? `${u1}_${u2}` : `${u2}_${u1}`;
}

function formatTimestamp(ts) {
    const d = new Date(ts);
    let h = d.getHours();
    const m = d.getMinutes();
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m < 10 ? '0' + m : m} ${ap}`;
}

function formatFullTimestamp(ts) {
    const d = new Date(ts);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} at ${formatTimestamp(ts)}`;
}

function getProfilePicHTML(u, sz = '2.5rem') {
    return u.profilePicUrl ? `<img src="${u.profilePicUrl}" alt="Pic">` : `<span style="font-size:${sz};line-height:1;user-select:none;">${u.name ? u.name.charAt(0).toUpperCase() : '?'}</span>`;
}

function getVerifiedBadgeHTML(u) {
    return (u && u.isVerified) ? `<span class="verified-badge" title="Verified"><svg viewBox="0 0 16 16"><path d="M6.75 12.13l-3.48-3.48c-.3-.3-.78-.3-1.06 0s-.3.78 0 1.06l4 4c.3.3.78.3 1.06 0l8.5-8.5c.3-.3.3-.78 0-1.06s-.78-.3-1.06 0L6.75 12.13z"/></svg></span>` : '';
}

function getBengaliErrorMessage(code) {
    switch (code) {
        case 'auth/email-already-in-use': return "ইমেইলটি ইতিমধ্যে ব্যবহার হয়েছে।";
        case 'auth/invalid-email': return "ইমেইল ঠিকানাটি সঠিক নয়।";
        case 'auth/weak-password': return "পাসওয়ার্ড দুর্বল (৬+ অক্ষর)।";
        case 'auth/user-not-found': return "অ্যাকাউন্ট পাওয়া যায়নি।";
        case 'auth/wrong-password': return "পাসওয়ার্ড ভুল।";
        default: return "সমস্যা: " + code;
    }
}

// Global Cloudinary Upload Function
async function uploadToCloudinary(file, resourceType) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (data.error) {
            console.error("Cloudinary Error:", data.error);
            throw new Error(data.error.message);
        }
        return data.secure_url;
    } catch (error) {
        console.error("Upload error:", error);
        showNotification("Upload Failed: " + error.message);
        return null;
    }
}