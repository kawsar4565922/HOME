const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupBtn = document.getElementById('show-signup');
const showLoginBtn = document.getElementById('show-login');

function handleSuccessfulAuth(user) {
    db.ref('users/' + user.uid).once('value').then(snapshot => {
        if (snapshot.exists()) {
            currentUserData = snapshot.val();
            checkPinStatus(user); // From js-lock.js
        } else {
            showCustomAlert("প্রোফাইল ডাটা পাওয়া যায়নি।");
            auth.signOut();
        }
    }).catch(error => {
        showCustomAlert("ডাটা লোড সমস্যা: " + error.message);
        auth.signOut();
    });
}

function initializeAuthListener() {
    auth.onAuthStateChanged(user => {
        cleanupListeners(); // Defined in js-home.js
        isAppUnlocked = false;
        if (user) {
            currentUser = user; if (!authStateInitialized) { authStateInitialized = true; authStateResolve(); }
            const userRef = db.ref('users/' + user.uid); if (contactListeners.currentUser) contactListeners.currentUser.off(); contactListeners.currentUser = userRef;
            userRef.on('value', snapshot => {
                const wasNotInitialized = !currentUserData;
                if (snapshot.exists()) {
                    currentUserData = snapshot.val();
                    if (!currentUserData.blockedUsers) currentUserData.blockedUsers = {};
                    
                    // Update profile modal if open
                    const profileViewModal = document.getElementById('profile-view-modal');
                    if (!profileViewModal.classList.contains('hidden')) {
                         // Elements from js-profile.js
                        document.getElementById('profile-pic-wrapper').innerHTML = getProfilePicHTML(currentUserData, '4.5rem');
                        document.getElementById('profile-view-name').innerHTML = `${currentUserData.name}${getVerifiedBadgeHTML(currentUserData)}`;
                        document.getElementById('profile-view-email').textContent = currentUserData.email;
                        document.getElementById('profile-user-email-text').textContent = currentUserData.email;
                    }
                    
                    if (wasNotInitialized) {
                        checkPinStatus(user);
                        listenForBlockedUsers(user.uid); // From js-profile.js
                        listenForUnreadCounts(); // From js-home.js
                    } else if (!isAppUnlocked && document.getElementById('calculator-lock-view').classList.contains('hidden') && document.getElementById('auth-view').classList.contains('hidden')) {
                         checkPinStatus(user);
                    }
                } else currentUserData = null;
                if (userDataResolve) { userDataResolve(); userDataResolve = null; }
            });
        } else {
            currentUser = null; currentUserData = null; appInitialized = false;
            const calculatorLockView = document.getElementById('calculator-lock-view');
            if (calculatorLockView && !calculatorLockView.classList.contains('hidden')) showView('auth-view'); else showView('auth-view');
            if (notificationBadge) { notificationBadge.classList.add('hidden'); notificationBadge.textContent = '0'; unreadNotificationCount = 0; }
            if (!authStateInitialized) { authStateInitialized = true; authStateResolve(); }
            if (userDataResolve) { userDataResolve(); userDataResolve = null; }
        }
    });
}

loginForm.addEventListener('submit', (e) => { e.preventDefault(); auth.signInWithEmailAndPassword(loginForm['login-email'].value, loginForm['login-password'].value).then((u) => handleSuccessfulAuth(u.user)).catch(e => showCustomAlert(getBengaliErrorMessage(e.code))); });

signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    auth.createUserWithEmailAndPassword(signupForm['signup-email'].value, signupForm['signup-password'].value).then((u) => {
        const user = u.user;
        db.ref('users/' + user.uid).set({ uid: user.uid, email: user.email, name: user.uid, profilePicUrl: "", isVerified: false }).then(() => handleSuccessfulAuth(user)).catch(e => showCustomAlert(e.message));
    }).catch(e => showCustomAlert(getBengaliErrorMessage(e.code)));
});

showSignupBtn.addEventListener('click', () => { loginForm.classList.add('hidden'); signupForm.classList.remove('hidden'); });
showLoginBtn.addEventListener('click', () => { loginForm.classList.remove('hidden'); signupForm.classList.add('hidden'); });

auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).then(initializeAuthListener).catch(initializeAuthListener);