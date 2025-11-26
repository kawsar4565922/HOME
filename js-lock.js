const calculatorScreen = document.getElementById('calculator-screen');
const calcButtons = document.querySelectorAll('#calculator-lock-view .calc-btn');
const pinSetupModal = document.getElementById('pin-setup-modal');
const pinInputField = document.getElementById('pin-input-field');
const setPinButton = document.getElementById('set-pin-button');
const pinSetupError = document.getElementById('pin-setup-error');

let currentExpression = '0', userSecretPin = null, isAppUnlocked = false;

function resetCalculator() {
    currentExpression = '0';
    calculatorScreen.textContent = currentExpression;
}

function updateCalculatorScreen() {
    calculatorScreen.textContent = currentExpression || '0';
}

function isOperator(value) {
    return ['+', '-', '*', '/', '%'].includes(value);
}

function handleCalculatorInput(value) {
    userSecretPin = currentUserData ? currentUserData.secretPin : null;
    if (value >= '0' && value <= '9' || value === '.') {
        if (currentExpression === '0' && value !== '.') currentExpression = value; else currentExpression += value;
    } else if (isOperator(value)) {
        if (currentExpression === '0') return;
        if (!isOperator(currentExpression.slice(-1))) currentExpression += value; else currentExpression = currentExpression.slice(0, -1) + value;
    } else if (value === 'C') resetCalculator(); else if (value === 'D') {
        currentExpression = currentExpression.slice(0, -1); if (currentExpression.length === 0) currentExpression = '0';
    } else if (value === '=') {
        if (userSecretPin && currentExpression === userSecretPin) { showMainAppView(); return; }
        try { const result = eval(currentExpression.replace(/×/g, '*').replace(/÷/g, '/')); currentExpression = String(result); } catch (e) { currentExpression = 'Error'; showNotification('Invalid expression.', 3000); }
    }
    if (userSecretPin && currentExpression.length === 4 && currentExpression === userSecretPin) { showMainAppView(); currentExpression = '0'; isAppUnlocked = true; return; }
    updateCalculatorScreen();
}

calcButtons.forEach(button => { button.addEventListener('click', () => { handleCalculatorInput(button.dataset.value); }); });

function checkPinStatus(user) {
    db.ref(`users/${user.uid}/secretPin`).once('value').then(snapshot => {
        const secretPin = snapshot.val();
        if (secretPin) {
            currentUserData.secretPin = secretPin;
            showView('calculator-lock-view');
        } else {
            showModal('pin-setup-modal');
            history.pushState(null, '', window.location.pathname);
        }
    }).catch(err => { showCustomAlert("কোড চেক সমস্যা: " + err.message); auth.signOut(); });
}

setPinButton.addEventListener('click', () => {
    const newPin = pinInputField.value.trim();
    if (newPin.length === 4 && /^\d{4}$/.test(newPin)) {
        db.ref(`users/${currentUser.uid}/secretPin`).set(newPin).then(() => {
            currentUserData.secretPin = newPin;
            showModal('pin-setup-modal', false);
            showNotification('গোপন কোড সেট করা হয়েছে!');
            showView('calculator-lock-view');
            resetCalculator();
            if (history.state) history.back();
        }).catch(err => { pinSetupError.textContent = 'সমস্যা হয়েছে: ' + err.message; });
    } else pinSetupError.textContent = 'দয়া করে ৪-সংখ্যার সংখ্যা দিন।';
});

function showMainAppView() {
    showPanel('home-content');
    listenForContacts(); // From js-home.js
    populateAllFriendsList(); // From js-home.js
    listenForNotifications(); // From js-home.js
    appInitialized = true;
    isAppUnlocked = true;
    showView('main-view');
}