-- C10 (for LOCAZ M8.1): the return fees of the rental agreement as post-charge types. Additive.
ALTER TYPE "PostChargeType" ADD VALUE 'LATE_RETURN';
ALTER TYPE "PostChargeType" ADD VALUE 'EXTRA_KM';
ALTER TYPE "PostChargeType" ADD VALUE 'CLEANING';
