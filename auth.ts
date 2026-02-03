import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { AuthError } from 'next-auth';
import { authConfig } from './auth.config';
import { z } from 'zod';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
import postgres from 'postgres';
 
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
 
async function getUser(email: string): Promise<User | undefined> {
  try {
    const normalizedEmail = normalizeEmail(email);
    const user =
      await sql<User[]>`SELECT * FROM users WHERE lower(email) = ${normalizedEmail}`;
    return user[0];
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
 
export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);
 
        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordsMatch = await bcrypt.compare(password, user.password);

          if (passwordsMatch) {
            if (!user.is_verified) {
              throw new AuthError('EMAIL_NOT_VERIFIED');
            }
            return user;
          }
        }
 
        console.log('Invalid credentials');
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token?.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
});
