import { getUncachableStripeClient } from './stripeClient.js';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();

  const existing = await stripe.products.list({ limit: 100 });
  if (existing.data.length > 0) {
    console.log('Products already exist, skipping seed.');
    existing.data.forEach(p => {
      console.log(`  - ${p.name} (${p.id})`);
    });
    return;
  }

  console.log('Creating products...');

  const proProduct = await stripe.products.create({
    name: 'Profile Optimization',
    description: 'Full profile optimization for one dating app. Includes bio rewrite, prompt optimization, photo strategy, and match targeting.',
    metadata: {
      tier: 'pro',
      features: 'bio_rewrite,prompt_optimization,photo_strategy,tone_adjustments,signal_removal,target_alignment',
    },
  });
  const proPrice = await stripe.prices.create({
    product: proProduct.id,
    unit_amount: 1900,
    currency: 'usd',
  });
  console.log(`Created: ${proProduct.name} - $19 (${proPrice.id})`);

  const premiumProduct = await stripe.products.create({
    name: 'Elite Profile Optimization',
    description: 'Premium optimization across all your dating apps. Includes everything in Pro plus unlimited app coverage, ongoing suggestions, and priority support.',
    metadata: {
      tier: 'premium',
      features: 'all_pro_features,unlimited_apps,ongoing_suggestions,priority_support',
    },
  });
  const premiumPrice = await stripe.prices.create({
    product: premiumProduct.id,
    unit_amount: 4900,
    currency: 'usd',
  });
  console.log(`Created: ${premiumProduct.name} - $49 (${premiumPrice.id})`);

  console.log('\nDone! Products created in Stripe.');
}

seedProducts().catch(console.error);
