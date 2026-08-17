/* =========================================================
   AUTH.JS — FIREBASE AUTHENTICATION
   Username/email + password. No Google, no OTP.
   ========================================================= */

const firebaseConfig = (window.RUNTIME_CONFIG && window.RUNTIME_CONFIG.firebase) || {};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    console.error('[ARXZY] Firebase configuration is missing.');
}

if (typeof firebase === 'undefined') {
    throw new Error('Firebase SDK belum dimuat.');
}
if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    throw new Error('Konfigurasi Firebase tidak lengkap.');
}
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
window.__ARXZY_DB__ = firebase.database();

let firebaseAuth = null;

function getFirebaseAuth() {
    if (!firebaseAuth) {
        if (typeof firebase === 'undefined' || !firebase.auth) {
            throw new Error('Firebase Authentication SDK belum dimuat.');
        }
        firebaseAuth = firebase.auth();
    }
    return firebaseAuth;
}

function usernameToAuthEmail(username) {
    const normalized = String(username || '').trim().toLowerCase();
    if (normalized.includes('@')) return normalized;
    return normalized.replace(/[^a-z0-9._-]/g, '') + '@pikjamail.com';
}

function authIdentifierLabel(identifier) {
    return String(identifier || '').trim().includes('@') ? 'email' : 'username';
}

function normalizeUsername(value) {
    return String(value || '').trim().toLowerCase();
}

function isAdminUsername(username) {
    return normalizeUsername(username) === normalizeUsername(
        window.ADMIN_CONFIG && window.ADMIN_CONFIG.username || 'paneladmin'
    );
}

function isAdminFirebaseUser(user) {
    return !!(
        user &&
        window.ADMIN_CONFIG &&
        user.uid === window.ADMIN_CONFIG.uid
    );
}

function firebaseAuthErrorMessage(error) {
    const code = error && error.code ? error.code : '';
    const messages = {
        'auth/email-already-in-use': 'Username tersebut sudah terdaftar.',
        'auth/invalid-email': 'Username tidak valid.',
        'auth/weak-password': 'Password minimal 6 karakter.',
        'auth/user-not-found': 'Username atau password salah.',
        'auth/wrong-password': 'Username atau password salah.',
        'auth/invalid-credential': 'Username atau password salah.',
        'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi beberapa saat.',
        'auth/network-request-failed': 'Koneksi ke Firebase gagal.',
        'auth/operation-not-allowed': 'Firebase Authentication Email/Password belum diaktifkan di Console.'
    };
    return messages[code] || (error && error.message) || 'Autentikasi gagal.';
}

async function firebaseRegisterUsername(username, password, profileData) {
    const auth = getFirebaseAuth();
    const cleanUsername = normalizeUsername(username);

    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
        throw new Error('Username harus 3-30 karakter dan hanya boleh berisi huruf, angka, titik, garis bawah, atau tanda minus.');
    }
    if (!password || password.length < 6) {
        throw new Error('Password minimal 6 karakter.');
    }
    if (isAdminUsername(cleanUsername)) {
        throw new Error('Username tersebut khusus untuk admin.');
    }

    try {
        const credential = await auth.createUserWithEmailAndPassword(
            usernameToAuthEmail(cleanUsername),
            password
        );

        const user = credential.user;
        await user.updateProfile({ displayName: cleanUsername });

        const safeProfile = Object.assign({}, profileData || {}, {
            username: cleanUsername,
            uid: user.uid,
            role: 'User',
            isBanned: false
        });

        await window.__ARXZY_DB__.ref('users/' + cleanUsername).set(safeProfile);
        return user;
    } catch (error) {
        if (error && error.code && String(error.code).startsWith('auth/')) {
            throw new Error(firebaseAuthErrorMessage(error));
        }
        throw error;
    }
}

async function firebaseLoginUsername(username, password) {
    const auth = getFirebaseAuth();
    const identifier = String(username || '').trim();

    if (!identifier || !password) {
        throw new Error('Username/email dan password wajib diisi.');
    }

    try {
        const credential = await auth.signInWithEmailAndPassword(
            usernameToAuthEmail(identifier),
            password
        );

        const user = credential.user;
        const admin = isAdminFirebaseUser(user);
        let profile = {};

        // Firebase displayName is the canonical username created by this app.
        const canonicalUsername = normalizeUsername(
            user.displayName || String(user.email || '').split('@')[0]
        );

        if (!admin) {
            const snapshot = await window.__ARXZY_DB__.ref('users/' + canonicalUsername).once('value');
            profile = snapshot.val();

            if (!profile) {
                await auth.signOut();
                throw new Error('Profil akun tidak ditemukan di database.');
            }

            if (profile.uid && profile.uid !== user.uid) {
                await auth.signOut();
                throw new Error('Data akun tidak cocok.');
            }

            if (profile.isBanned) {
                await auth.signOut();
                throw new Error('Akun Anda telah diblokir oleh Admin.');
            }
        }

        return {
            user,
            profile,
            isAdmin: admin,
            username: canonicalUsername
        };
    } catch (error) {
        if (error && error.code && String(error.code).startsWith('auth/')) {
            throw new Error(firebaseAuthErrorMessage(error));
        }
        throw error;
    }
}

async function firebaseLogout() {
    const auth = getFirebaseAuth();
    await auth.signOut();
}


/* Fixed admin identity:
   Firebase Authentication UID: hUUBbw8j3JViM7ZBXJ52UWFp7go2
*/


// Admin account requirement:
// UID is fixed in admin-config.js. The Firebase Auth account must use
// paneladmin@pikjamail.com if logging in with the username 'paneladmin'.
