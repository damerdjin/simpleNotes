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
        const schoolId = userData.school_id;
        if (!schoolId) {
            throw new Error('Un établissement est requis. Veuillez en sélectionner ou en créer un.');
        }

        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    wilaya: userData.wilaya,
                    city: userData.city,
                    school_id: schoolId,
                    full_name: userData.full_name || '',
                    role: 'teacher'
                }
            }
        });

        if (error) {
            console.log("Supabase signUp error:", error);
            if (error.message.includes('already registered')) {
                throw new Error('Cette adresse e-mail est déjà utilisée.');
            }
            throw error;
        }

        const user = data.user;
        if (!user) throw new Error('Utilisateur non créé.');

        // Rattacher l'utilisateur à l'école (seulement si pas déjà créée par qqn)
        await supabase.from('schools').update({ created_by: user.id }).eq('id', schoolId).is('created_by', null);

        // Mettre à jour la table users avec le school_id
        const { error: userUpdateError } = await supabase
            .from('users')
            .upsert({
                id: user.id,
                email: user.email,
                school_id: schoolId,
                city: userData.city,
                wilaya: userData.wilaya
            }, { onConflict: 'id' });

        if (userUpdateError) {
            console.error('Error updating users table:', userUpdateError);
        }

        // Associer les classes sélectionnées
        if (userData.selectedClasses && userData.selectedClasses.length > 0) {
            const now = new Date();
            const currentYear = now.getFullYear();
            const academicYear = now.getMonth() >= 8 
                ? `${currentYear}/${currentYear + 1}` 
                : `${currentYear - 1}/${currentYear}`;

            for (const className of userData.selectedClasses) {
                try {
                    // Try to find or create the class
                    const { data: cls, error: clsError } = await supabase
                        .from('classes')
                        .upsert({ 
                            school_id: schoolId, 
                            name: className, 
                            academic_year: academicYear 
                        }, { onConflict: 'school_id,academic_year,name' })
                        .select()
                        .single();

                    if (clsError) {
                        console.error(`Error finding/creating class ${className}:`, clsError);
                        continue;
                    }

                    if (cls) {
                        // Link teacher to class
                        await supabase
                            .from('teacher_classes')
                            .insert([{ 
                                user_id: user.id, 
                                class_id: cls.id 
                            }]);
                    }
                } catch (e) {
                    console.error(`Failed to link class ${className}:`, e);
                }
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
            redirectTo: window.location.origin + '/reset-password.html',
        });
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Reset password error:', error);
        throw error;
    }
}
