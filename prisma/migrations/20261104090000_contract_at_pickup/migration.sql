-- Partner bookings whose contract is signed at pickup, after the vehicle check-in (LOCAZ M11.1).
ALTER TABLE "Transaction" ADD COLUMN "contractAtPickup" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Transaction" ADD COLUMN "contractOpenedAt" TIMESTAMP(3);
