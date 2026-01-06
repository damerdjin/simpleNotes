import bcrypt from 'bcryptjs';
import { supabase, allowCors } from '../_lib/supabase.js';
import { signToken, setAuthCookie } from '../_lib/utils.js';
import { generateCsrfToken, setCsrfCookie } from '../_lib/csrf.js';
import { asyncHandler, validateRequired, validateEmail, validatePassword } from '../_lib/errorHandler.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, city, wilaya, school_id, new_school } = req.body;

  // Basic validation
  validateRequired({ email, password, city, wilaya }, ['email', 'password', 'city', 'wilaya']);
  validateEmail(email);
  validatePassword(password);
  
  // School validation
  if (!school_id && !new_school) {
    return res.status(400).json({ error: 'School is required' });
  }

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (existingUser) {
    return res.status(409).json({ error: 'User already exists' });
  }

  let finalSchoolId = school_id;

  // Handle new school creation
  if (new_school) {
    // Validate new school data
    validateRequired(new_school, ['name', 'commune_id']);

    const { data: createdSchool, error: schoolError } = await supabase
      .from('schools')
      .insert([{
        name: new_school.name,
        commune_id: new_school.commune_id,
        approved: false // Default to not approved
      }])
      .select('id')
      .single();

    if (schoolError) {
      console.error('Create School Error:', schoolError);
      return res.status(500).json({ error: 'Error creating school' });
    }
    finalSchoolId = createdSchool.id;
  }

  // Hash password
  const password_hash = await bcrypt.hash(password, 10);

  // Create user
  const { data: newUser, error: createError } = await supabase
    .from('users')
    .insert([{ 
      email, 
      password_hash,
      city,
      wilaya,
      school_id: finalSchoolId
    }])
    .select('id, email, created_at, token_version')
    .single();

  if (createError) {
    console.error('Create User Error:', createError);
    return res.status(500).json({ error: 'Error creating user', details: createError });
  }
  
  // If we created a new school, update its created_by
  if (new_school) {
    await supabase
      .from('schools')
      .update({ created_by: newUser.id })
      .eq('id', finalSchoolId);
  }

  // Generate token
  const token = signToken({ id: newUser.id, email: newUser.email, token_version: newUser.token_version });

  // Set auth cookie
  setAuthCookie(res, token);

  // Generate and set CSRF token
  const csrfToken = generateCsrfToken();
  setCsrfCookie(res, csrfToken);
  res.setHeader('X-CSRF-Token', csrfToken);

  return res.status(201).json({ user: newUser });
};

export default allowCors(asyncHandler(handler));
