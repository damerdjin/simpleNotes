const AUTH_API = '/api/auth';
const SCHOOLS_API = '/api/schools';

export async function login(email, password) {
    try {
        const response = await fetch(`${AUTH_API}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        return data.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

export async function register(userData) {
    try {
        const response = await fetch(`${AUTH_API}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
            credentials: 'include'
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        return data.user;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

export async function logout() {
    try {
        await fetch(`${AUTH_API}/logout`, { credentials: 'include' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

export async function checkAuth() {
    try {
        console.log('Checking authentication...');
        const response = await fetch(`${AUTH_API}/me`, { credentials: 'include' });
        if (!response.ok) {
            console.log('Auth check failed:', response.status);
            throw new Error('Not authenticated');
        }
        const data = await response.json();
        console.log('Auth check success:', data.user.email);
        return data.user;
    } catch (error) {
        console.error('CheckAuth error:', error);
        // If we are on login or register page, don't redirect
        const path = window.location.pathname;
        if (!path.includes('login.html') && !path.includes('register.html')) {
            console.log('Redirecting to login...');
            window.location.href = '/login.html';
        }
        return null;
    }
}

export async function getSchools() {
    try {
        const response = await fetch(SCHOOLS_API);
        if (!response.ok) throw new Error('Failed to fetch schools');
        const data = await response.json();
        return data.schools;
    } catch (error) {
        console.error(error);
        return [];
    }
}
