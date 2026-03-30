import { getUncachableStripeClient } from '../server/stripeClient.js';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();
    console.log('Creating Magnet products in Stripe...');

    const existing = await stripe.products.search({
      query: "name:'Magnet Full Report' AND active:'true'",
    });
    if (existing.data.length > 0) {
      console.log('Products already exist. IDs:');
      for (const p of existing.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true });
        for (const pr of prices.data) {
          console.log(`  ${p.name} → price ${pr.id} ($${(pr.unit_amount! / 100).toFixed(2)})`);
        }
      }
      const bundleExisting = await stripe.products.search({
        query: "name:'Magnet Profile Pack' AND active:'true'",
      });
      for (const p of bundleExisting.data) {
        const prices = await stripe.prices.list({ product: p.id, active: true });
        for (const pr of prices.data) {
          console.log(`  ${p.name} → price ${pr.id} ($${(pr.unit_amount! / 100).toFixed(2)})`);
        }
      }
      return;
    }

    const fullReport = await stripe.products.create({
      name: 'Magnet Full Report',
      description: 'One-time deep dive: per-photo breakdown, prompt coaching, photo swap picks, optimal photo order, and category-level AI analysis.',
      metadata: { type: 'full-report' },
    });
    console.log(`Created product: ${fullReport.name} (${fullReport.id})`);

    const fullReportPrice = await stripe.prices.create({
      product: fullReport.id,
      unit_amount: 499,
      currency: 'usd',
    });
    console.log(`Created price: $4.99 one-time (${fullReportPrice.id})`);

    const profilePack = await stripe.products.create({
      name: 'Magnet Profile Pack',
      description: '3 Full Reports — use across any platforms. Never expires.',
      metadata: { type: 'profile-pack' },
    });
    console.log(`Created product: ${profilePack.name} (${profilePack.id})`);

    const profilePackPrice = await stripe.prices.create({
      product: profilePack.id,
      unit_amount: 1099,
      currency: 'usd',
    });
    console.log(`Created price: $10.99 one-time (${profilePackPrice.id})`);

    console.log('\nDone! Price IDs for reference:');
    console.log(`  Full Report:   ${fullReportPrice.id}`);
    console.log(`  Profile Pack:  ${profilePackPrice.id}`);
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
