/** Synthetic partner booking payload shared by the C2 tests (no real customer data). */
export function buildBookingPayload(overrides: Record<string, unknown> = {}) {
  return {
    externalRef: "LZ-TEST-0001",
    customer: {
      firstName: "Alice",
      lastName: "Martin",
      email: "alice.martin@locaz.test",
      phone: "+33612345678",
      locale: "fr",
    },
    startAt: "2026-11-02T09:00:00+01:00",
    endAt: "2026-11-05T18:00:00+01:00",
    timezone: "Europe/Paris",
    rental: {
      vehicle: { model: "Peugeot 208", plate: "AB-123-CD", category: "Compact" },
      pickup: { place: "Nice Airport T2", address: "Rue Costes et Bellonte, 06200 Nice" },
      return: { place: "Nice Airport T2" },
      mileage: { unlimited: false, includedKm: 900, extraKmPrice: 25 },
      options: ["Child seat", "Additional driver"],
      protection: "Standard protection",
      deductible: 120000,
      deposit: 80000,
      fuelPolicy: "Full to full",
      priceLines: [
        { label: "Rental", quantity: 3, unit: "days", unitAmount: 4500, total: 13500 },
        { label: "Child seat", quantity: 1, unitAmount: 1500, total: 1500 },
      ],
    },
    amount: 15000,
    depositAmount: 80000,
    currency: "EUR",
    steps: {
      identity: true,
      documents: true,
      contract: true,
      checkIn: true,
      checkOut: true,
      payment: true,
      hold: true,
    },
    returnUrl: "https://locaz.co/bookings/LZ-TEST-0001",
    ...overrides,
  }
}
