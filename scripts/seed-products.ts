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
      const addonExisting = await stripe.products.search({
        query: "name:'Magnet Analyze Another App' AND active:'true'",
      });
      for (const p of addonExisting.data) {
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
      unit_amount: 299,
      currency: 'usd',
    });
    console.log(`Created price: $2.99 one-time (${fullReportPrice.id})`);

    const addOnReport = await stripe.products.create({
      name: 'Magnet Analyze Another App',
      description: 'Analyze a different dating app platform — full report included. Works on Tinder, Bumble, Hinge & more.',
      metadata: { type: 'add-on-report' },
    });
    console.log(`Created product: ${addOnReport.name} (${addOnReport.id})`);

    const addOnReportPrice = await stripe.prices.create({
      product: addOnReport.id,
      unit_amount: 199,
      currency: 'usd',
    });
    console.log(`Created price: $1.99 one-time (${addOnReportPrice.id})`);

    console.log('\nDone! Price IDs for reference:');
    console.log(`  Full Report:         ${fullReportPrice.id}`);
    console.log(`  Analyze Another App: ${addOnReportPrice.id}`);
  } catch (error: any) {
    console.error('Error creating products:', error.message);
    process.exit(1);
  }
}

createProducts();
