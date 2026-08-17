/* =========================================================
   AUTH.JS — FIREBASE AUTHENTICATION
   Login/register menggunakan Firebase Authentication.
   Tidak menggunakan Google Sign-In dan tidak menggunakan OTP.
   ========================================================= */

/* =========================================================
   FIREBASE AUTHENTICATION
   Username is mapped to a Firebase email alias because
   Firebase Email/Password Authentication requires an email.
   The real user's email is NOT required from the UI.
   ========================================================= */

let firebaseAuth = null;

function getFirebaseAuth() {
    if (!firebaseAuth) {
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK belum dimuat.');
        }
        firebaseAuth = firebase.auth();
    }
    return firebaseAuth;
}

function usernameToAuthEmail(username) {
    const normalized = String(username || '').trim().toLowerCase();
    return normalized.replace(/[^a-z0-9._-]/g, '') + '@pikjamail.com';
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
        'auth/network-request-failed': 'Koneksi ke Firebase gagal.'
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

        await db.ref('users/' + cleanUsername).set(safeProfile);
        return user;
    } catch (error) {
        throw new Error(firebaseAuthErrorMessage(error));
    }
}

async function firebaseLoginUsername(username, password) {
    const auth = getFirebaseAuth();
    const cleanUsername = normalizeUsername(username);

    if (!cleanUsername || !password) {
        throw new Error('Username dan password wajib diisi.');
    }

    try {
        const credential = await auth.signInWithEmailAndPassword(
            usernameToAuthEmail(cleanUsername),
            password
        );

        const user = credential.user;
        const admin = isAdminFirebaseUser(user);
        let profile = {};

        // Admin identity is verified by Firebase Authentication UID.
        // Do not require a readable users/paneladmin record for the admin login.
        if (!admin) {
            const snapshot = await db.ref('users/' + cleanUsername).once('value');
            profile = snapshot.val();

            if (!profile) {
                await auth.signOut();
                throw new Error('Profil akun tidak ditemukan di database.');
            }
            if (profile.isBanned) {
                await auth.signOut();
                throw new Error('Akun Anda telah diblokir oleh Admin.');
            }
            if (profile.uid && profile.uid !== user.uid) {
                await auth.signOut();
                throw new Error('Data akun tidak cocok.');
            }
        }

        return { user, profile, isAdmin: admin };
    } catch (error) {
        if (error && error.message && !String(error.message).startsWith('auth/')) {
            throw error;
        }
        throw new Error(firebaseAuthErrorMessage(error));
    }
}

async function firebaseLogout() {
    const auth = getFirebaseAuth();
    await auth.signOut();
}


/* Fixed admin identity:
   Firebase Authentication UID: hUUBbw8j3JViM7ZBXJ52UWFp7go2
*/
