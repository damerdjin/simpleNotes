
import { createClient } from '@supabase/supabase-js';

// Config from src/ui/config.js (as seen in system reminder)
const SUPABASE_URL = 'https://lgmzydadswnvfrkdnycu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbXp5ZGFkc3dudmZya2RueWN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyOTQ3MDgsImV4cCI6MjA4Mjg3MDcwOH0.KC_zTqsHqXUO9f1cuqGOZWZ6aZh4VPW51cbzLr-QlEo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


async function testRegistration() {
    console.log('Testing registration...');
    const email = `trae.debugger.${Date.now()}@gmail.com`;
    const password = 'password123';
    
    // Simulate data from registration form
    const userData = {
        email,
        password,
        wilaya: "01",
        commune: "Adrar",
        school_id: null, // New school scenario or just null
        full_name: "Test User"
    };

    try {
        console.log(`Attempting to sign up with email: ${email}`);
        
        const { data, error } = await supabase.auth.signUp({
            email: userData.email,
            password: userData.password,
            options: {
                data: {
                    wilaya: userData.wilaya,
                    city: userData.commune,
                    school_id: userData.school_id,
                    full_name: userData.full_name
                }
            }
        });

        if (error) {
            console.error('Supabase Auth Error:', JSON.stringify(error, null, 2));
        } else {
            console.log('Supabase Auth Success:', data);
            
            // Check if user exists in public.users (simulating what the app expects)
            // Wait a bit for trigger
            await new Promise(r => setTimeout(r, 2000));
            
            const { data: publicUser, error: publicError } = await supabase
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();
                
            if (publicError) {
                console.error('Public User Check Error:', publicError);
            } else {
                console.log('Public User Found:', publicUser);
            }
        }
    } catch (err) {
        console.error('Unexpected Error:', err);
    }
}

testRegistration();
