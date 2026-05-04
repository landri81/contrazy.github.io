import fs from "node:fs/promises"
import path from "node:path"

import Stripe from "stripe"

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is required.")
}

const stripe = new Stripe(stripeSecretKey)

const planDefinitions = [
  {
    key: "starter",
    name: "Starter",
    description: "Contrazy Starter plan",
    prices: [
      { envKey: "STRIPE_PRICE_STARTER_MONTHLY", lookupKey: "contrazy_starter_monthly", unitAmount: 900, interval: "month" },
      { envKey: "STRIPE_PRICE_STARTER_YEARLY", lookupKey: "contrazy_starter_yearly", unitAmount: 9200, interval: "year" },
    ],
  },
  {
    key: "pro",
    name: "Pro",
    description: "Contrazy Pro plan",
    prices: [
      { envKey: "STRIPE_PRICE_PRO_MONTHLY", lookupKey: "contrazy_pro_monthly", unitAmount: 2400, interval: "month" },
      { envKey: "STRIPE_PRICE_PRO_YEARLY", lookupKey: "contrazy_pro_yearly", unitAmount: 24500, interval: "year" },
    ],
  },
  {
    key: "business",
    name: "Business",
    description: "Contrazy Business plan",
    prices: [
      { envKey: "STRIPE_PRICE_BUSINESS_MONTHLY", lookupKey: "contrazy_business_monthly", unitAmount: 4900, interval: "month" },
      { envKey: "STRIPE_PRICE_BUSINESS_YEARLY", lookupKey: "contrazy_business_yearly", unitAmount: 50000, interval: "year" },
    ],
  },
]

async function getOrCreateProduct(plan) {
  const products = await stripe.products.list({ active: true, limit: 100 })
  const existing = products.data.find(
    (product) => product.metadata?.planKey === plan.key || product.name === plan.name
  )

  if (existing) {
    return existing
  }

  return stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: {
      planKey: plan.key,
    },
  })
}

async function getOrCreatePrice(productId, planKey, priceDefinition) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  })

  const existing = prices.data.find(
    (price) =>
      price.lookup_key === priceDefinition.lookupKey ||
      (price.metadata?.planKey === planKey &&
        price.metadata?.billingInterval === priceDefinition.interval &&
        price.unit_amount === priceDefinition.unitAmount)
  )

  if (existing) {
    return existing
  }

  return stripe.prices.create({
    currency: "eur",
    unit_amount: priceDefinition.unitAmount,
    recurring: {
      interval: priceDefinition.interval,
    },
    product: productId,
    lookup_key: priceDefinition.lookupKey,
    metadata: {
      planKey,
      billingInterval: priceDefinition.interval === "month" ? "monthly" : "yearly",
    },
  })
}

const envEntries = []

for (const plan of planDefinitions) {
  const product = await getOrCreateProduct(plan)
  console.log(`Using product ${plan.name}: ${product.id}`)

  for (const priceDefinition of plan.prices) {
    const price = await getOrCreatePrice(product.id, plan.key, priceDefinition)
    console.log(`  ${priceDefinition.envKey}=${price.id}`)
    envEntries.push(`${priceDefinition.envKey}=${price.id}`)
  }
}

const outputPath = path.join(process.cwd(), ".env.subscription.generated")
const contents = `${envEntries.join("\n")}\n`
await fs.writeFile(outputPath, contents, "utf8")

console.log(`\nWrote ${outputPath}`)
