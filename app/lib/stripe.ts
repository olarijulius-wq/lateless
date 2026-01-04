// app/lib/stripe.ts
import Stripe from 'stripe';

// Lihtne variant – apiVersion välja jätame, et TypeScript ei vinguks
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);