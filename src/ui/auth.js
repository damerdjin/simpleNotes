import { supabase } from './supabase-client.js';

// Update cookie on auth state change (token refresh, etc.)
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        const isSecure = window.location.protocol === 'https:';
        document.cookie = `auth_token=${session.access_token}; path=/; max-age=${session.expires_in}; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    } else if (event === 'SIGNED_OUT') {
        const isSecure = window.location.protocol === 'https:';
        document.cookie = `auth_token=; path=/; max-age=0; SameSite=Lax${isSecure ? '; Secure' : ''}`;
    }
});

// Keep API constants if needed for other things, but Auth is now Supabase
const SCHOOLS_API = '/api/schools'; 

export async function login(email, password) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error;
        }

        return data.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

export async function register(userData) {
    try {
        // Handle new school creation logic
        let schoolId = userData.school_id;
        if (schoolId === "") schoolId = null;
        
        // If creating a new school, we might need to do it after signup 
        // because we need to be authenticated to create a school (RLS).
        // However, standard flow is: SignUp -> Trigger creates User -> Client creates School -> Client updates User.
        
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    wilaya: userData.wilaya, // Assuming this is ID
                    city: userData.commune,   // Assuming this is ID
                    school_id: schoolId,      // Can be null if new school
                    full_name: userData.full_name || ''
                }
            }
        });

        if (error) {
            console.log("Supabase signUp error:", error); // Log de l'erreur
            if (error.message.includes('already registered')) {
                throw new Error('Cette adresse e-mail est déjà utilisée. Si vous avez initié cette inscription, veuillez vérifier votre boîte de réception pour un lien de connexion. Sinon, veuillez vous connecter avec votre compte existant.');
            }
            throw error;
        }

        const user = data.user;

        // If new school, create it and link it
        if (userData.new_school && user) {
            // We need to wait a bit for the session to be established? 
            // supabase.auth.signUp automatically signs in if email confirmation is disabled.
            // If enabled, we can't create the school yet.
            // Assuming email confirmation is OFF or we accept the risk.
            
            const { data: school, error: schoolError } = await supabase
                .from('schools')
                .insert([{
                    name: userData.new_school.name,
                    commune_id: userData.new_school.commune_id, // Ensure this matches DB schema
                    created_by: user.id,
                    approved: false
                }])
                .select()
                .single();

            if (schoolError) {
                console.error('Error creating school:', schoolError);
                // Non-blocking error? Or should we warn user?
            } else if (school) {
                // Update user with new school_id
                await supabase
                    .from('users')
                    .update({ school_id: school.id })
                    .eq('id', user.id);
            }
        }

        return user;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
}

export async function logout() {
    try {
        await supabase.auth.signOut();
        document.cookie = "auth_token=; path=/; max-age=0; SameSite=Lax; Secure";
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

export async function checkAuth() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
            // If we are on login or register page, don't redirect
            const path = window.location.pathname;
            if (path.includes('login.html') || path.includes('register.html')) {
                return null;
            }
            throw new Error('Not authenticated');
        }
        
        return session.user;
    } catch (error) {
        console.error('CheckAuth error:', error);
        // Avoid infinite redirect loop
        const path = window.location.pathname;
        if (!path.includes('login.html') && !path.includes('register.html')) {
            window.location.href = '/login.html';
        }
        return null;
    }
}

export async function getSchools(params = {}) {
    try {
        // Use Supabase directly for schools if possible, or fallback to API
        // Using API for now to ensure consistency with existing logic if it filters specially
        const queryString = new URLSearchParams(params).toString();
        const url = `${SCHOOLS_API}${queryString ? `?${queryString}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch schools');
        const data = await response.json();
        return data.schools;
    } catch (error) {
        console.error(error);
        return [];
    }
}

export async function resetPassword(email) {
    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html', // Or a dedicated page
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Reset password error:', error);
        throw error;
    }
}
