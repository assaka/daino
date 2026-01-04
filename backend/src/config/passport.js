const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { masterDbClient } = require('../database/masterConnection');
const { v4: uuidv4 } = require('uuid');

// Only configure Google OAuth if credentials are provided
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      scope: ['profile', 'email']
    },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🔍 Google OAuth profile received:', {
        id: profile.id,
        email: profile.emails[0]?.value,
        name: profile.name?.givenName + ' ' + profile.name?.familyName
      });

      // Extract user info from Google profile
      const googleUser = {
        email: profile.emails[0].value,
        first_name: profile.name?.givenName || '',
        last_name: profile.name?.familyName || '',
        avatar_url: profile.photos?.[0]?.value || null,
        google_id: profile.id
      };

      console.log('🔍 Looking for user with email:', googleUser.email);

      // Find existing user in master database
      const { data: existingUser, error: findError } = await masterDbClient
        .from('users')
        .select('*')
        .eq('email', googleUser.email)
        .maybeSingle();

      if (findError) {
        console.error('❌ Error finding user:', findError);
        throw findError;
      }

      let user;

      if (existingUser) {
        // Update existing user
        const { data: updatedUser, error: updateError } = await masterDbClient
          .from('users')
          .update({
            last_login: new Date().toISOString(),
            email_verified: true,
            avatar_url: googleUser.avatar_url || existingUser.avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error('❌ Error updating user:', updateError);
          throw updateError;
        }

        user = updatedUser;
        console.log('✅ Existing user logged in via Google OAuth:', user.email);
      } else {
        // Create new user with free credits
        const freeCredits = parseInt(process.env.FREE_CREDITS) || 30;
        const { data: newUser, error: createError } = await masterDbClient
          .from('users')
          .insert({
            id: uuidv4(),
            email: googleUser.email,
            first_name: googleUser.first_name,
            last_name: googleUser.last_name,
            avatar_url: googleUser.avatar_url,
            email_verified: true,
            password: '$2b$10$' + Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8),
            role: 'store_owner',
            account_type: 'agency',
            is_active: true,
            credits: freeCredits,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (createError) {
          console.error('❌ Error creating user:', createError);
          throw createError;
        }

        user = newUser;
        console.log('✅ New user created via Google OAuth:', user.email);

        // Record free credits as welcome bonus
        if (freeCredits > 0) {
          await masterDbClient
            .from('credit_transactions')
            .insert({
              user_id: user.id,
              amount: freeCredits,
              transaction_type: 'bonus',
              payment_status: 'completed',
              description: 'Welcome bonus - free credits for new account',
              created_at: new Date().toISOString()
            });
        }
      }

      return done(null, user);
    } catch (error) {
      console.error('❌ Google OAuth error:', error.message);
      return done(error, null);
    }
  }
  ));
} else {
  console.log('⚠️ Google OAuth not configured - missing environment variables');
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { data: user, error } = await masterDbClient
      .from('users')
      .select('id, email, first_name, last_name, phone, avatar_url, is_active, email_verified, last_login, role, credits, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error) {
      console.error('❌ Deserialize user error:', error);
      return done(error, null);
    }

    done(null, user);
  } catch (error) {
    console.error('❌ Deserialize user error:', error);
    done(error, null);
  }
});

module.exports = passport;