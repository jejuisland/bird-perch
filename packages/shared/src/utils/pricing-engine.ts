import { DetailedRates, VehicleRate } from '../types/parking';

export type PricingVehicleType = 'car' | 'motorcycle' | 'van' | 'truck';

export interface CalculationInput {
  arrivalTime: Date;
  exitTime: Date;
  vehicleType: PricingVehicleType;
  rates: VehicleRate;
  detailedRates?: DetailedRates;
  hasValidation?: boolean;
}

export interface FeeLineItem {
  label: string;
  minutes: number;
  amount: number;
  isFree?: boolean;
}

export interface FeeBreakdown {
  totalMinutes: number;
  billableMinutes: number;
  lineItems: FeeLineItem[];
  subtotal: number;
  cap?: number;
  total: number;
  confidence: 'low' | 'medium' | 'high' | 'none';
  warnings: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseHHMM(time: string): { h: number; m: number } {
  const parts = time.split(':');
  return { h: parseInt(parts[0], 10), m: parseInt(parts[1] ?? '0', 10) };
}

function minutesFromMidnight(hhMM: string): number {
  const { h, m } = parseHHMM(hhMM);
  return h * 60 + m;
}

function applyRounding(value: number, mode: 'ceil' | 'floor' | 'round' = 'ceil'): number {
  if (mode === 'floor') return Math.floor(value);
  if (mode === 'round') return Math.round(value);
  return Math.ceil(value);
}

function isWithinTimeWindow(time: Date, startHHMM: string, endHHMM: string): boolean {
  const timeMin = time.getHours() * 60 + time.getMinutes();
  const startMin = minutesFromMidnight(startHHMM);
  const endMin = minutesFromMidnight(endHHMM);
  if (startMin <= endMin) {
    return timeMin >= startMin && timeMin < endMin;
  }
  // Window wraps midnight (e.g., 22:00–06:00)
  return timeMin >= startMin || timeMin < endMin;
}

// Count how many overnight windows [cutoff, cutoff+8h] the parking span overlaps.
// Handles arrival already past cutoff and multi-night stays.
function countOvernightOverlaps(
  arrival: Date,
  exit: Date,
  cutoffHHMM: string,
  endHHMM?: string,
): number {
  const { h: ch, m: cm } = parseHHMM(cutoffHHMM);
  const OVERNIGHT_MS = 8 * 60 * 60 * 1000; // 8h default window
  let count = 0;

  // Start from the day before arrival to catch "arrival already in overnight window"
  const cursor = new Date(arrival);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  const endDay = new Date(exit);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    const windowStart = new Date(cursor);
    windowStart.setHours(ch, cm, 0, 0);

    let windowEnd: Date;
    if (endHHMM) {
      const { h: eh, m: em } = parseHHMM(endHHMM);
      windowEnd = new Date(cursor);
      windowEnd.setDate(windowEnd.getDate() + 1);
      windowEnd.setHours(eh, em, 0, 0);
    } else {
      windowEnd = new Date(windowStart.getTime() + OVERNIGHT_MS);
    }

    // Overlap: [arrival, exit] overlaps [windowStart, windowEnd]
    // exit >= windowStart catches arrival-already-past-cutoff case
    if (arrival < windowEnd && exit >= windowStart) {
      count++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

function zeroBreakdown(
  confidence: FeeBreakdown['confidence'],
  warnings: string[] = [],
): FeeBreakdown {
  return {
    totalMinutes: 0,
    billableMinutes: 0,
    lineItems: [],
    subtotal: 0,
    total: 0,
    confidence,
    warnings,
  };
}

// ─── Main calculation ─────────────────────────────────────────────────────────

export function calculateParkingFee(input: CalculationInput): FeeBreakdown {
  const { arrivalTime, exitTime, rates, detailedRates, hasValidation } = input;
  const warnings: string[] = [];
  const lineItems: FeeLineItem[] = [];

  // 1. Duration
  const totalMinutes = Math.round((exitTime.getTime() - arrivalTime.getTime()) / 60_000);
  if (totalMinutes <= 0) {
    return zeroBreakdown(
      detailedRates?.dataConfidence ?? 'none',
      ['Exit time must be after arrival time'],
    );
  }

  const confidence = detailedRates?.dataConfidence ?? 'none';

  // 2. Grace period
  let freeMinutes = rates.freeMinutes ?? 0;
  if (hasValidation) {
    const validationExtra =
      detailedRates?.validationDiscount?.discountMinutes ?? rates.validationMinutes ?? 0;
    freeMinutes += validationExtra;
  }
  if (freeMinutes > 0) {
    const graceMins = Math.min(freeMinutes, totalMinutes);
    lineItems.push({ label: `Free grace period`, minutes: graceMins, amount: 0, isFree: true });
  }
  const billableMinutes = Math.max(0, totalMinutes - freeMinutes);
  if (billableMinutes === 0) {
    return {
      totalMinutes,
      billableMinutes: 0,
      lineItems,
      subtotal: 0,
      total: 0,
      confidence,
      warnings,
    };
  }

  // 3. Flat rate check
  let subtotal = 0;

  const flatWindowStart =
    rates.flatRateWindowStart ??
    (rates.flatRateWindow ? rates.flatRateWindow.split('-')[0] : undefined);
  const flatWindowEnd =
    rates.flatRateWindowEnd ??
    (rates.flatRateWindow ? rates.flatRateWindow.split('-')[1] : undefined);

  const flatApplies =
    rates.flatRate !== undefined &&
    (!flatWindowStart || !flatWindowEnd || isWithinTimeWindow(arrivalTime, flatWindowStart, flatWindowEnd));

  if (flatApplies && rates.flatRate !== undefined) {
    lineItems.push({
      label: flatWindowStart ? `Flat rate (${flatWindowStart}–${flatWindowEnd})` : 'Flat rate',
      minutes: billableMinutes,
      amount: rates.flatRate,
    });
    subtotal = rates.flatRate;
  } else {
    // 4. Tiered rate
    const firstHours = rates.firstHours ?? 0;
    const firstThresholdMinutes = firstHours * 60;

    if (firstThresholdMinutes > 0 && rates.firstRate !== undefined) {
      lineItems.push({
        label: `First ${firstHours} hour${firstHours !== 1 ? 's' : ''}`,
        minutes: Math.min(billableMinutes, firstThresholdMinutes),
        amount: rates.firstRate,
      });
      subtotal += rates.firstRate;
    } else if (firstThresholdMinutes === 0 && rates.firstRate !== undefined) {
      // No first-period window — treat as base charge
      subtotal += rates.firstRate;
    }

    if (billableMinutes > firstThresholdMinutes) {
      const remainingMinutes = billableMinutes - firstThresholdMinutes;
      const intervalMinutes = rates.succeedingRateIntervalMinutes ?? 60;
      const rounding = rates.partialHourRounding ?? 'ceil';
      const intervals = applyRounding(remainingMinutes / intervalMinutes, rounding);

      if (rates.succeedingRate !== undefined) {
        const succeedingCost = intervals * rates.succeedingRate;
        const succeedingHours = intervals * (intervalMinutes / 60);
        lineItems.push({
          label: `Next ${succeedingHours % 1 === 0 ? succeedingHours : succeedingHours.toFixed(1)} hour${succeedingHours !== 1 ? 's' : ''}`,
          minutes: remainingMinutes,
          amount: succeedingCost,
        });
        subtotal += succeedingCost;
      } else {
        warnings.push('Succeeding rate unknown — estimate shows first-period cost only');
      }
    }
  }

  // 5. Overnight check
  const overnightCutoff = rates.overnightWindowStart ?? rates.overnightCutoff;

  if (rates.overnightCharge && overnightCutoff) {
    const overlaps = countOvernightOverlaps(
      arrivalTime,
      exitTime,
      overnightCutoff,
      rates.overnightWindowEnd,
    );
    if (overlaps > 0) {
      const overnightTotal = overlaps * rates.overnightCharge;
      lineItems.push({
        label: overlaps > 1
          ? `Overnight charge (×${overlaps})`
          : `Overnight charge (after ${overnightCutoff})`,
        minutes: 0,
        amount: overnightTotal,
      });
      subtotal += overnightTotal;
    }
  }

  // 6. Minimum charge
  if (rates.minimumCharge !== undefined && subtotal < rates.minimumCharge) {
    lineItems.push({
      label: 'Minimum charge applied',
      minutes: 0,
      amount: rates.minimumCharge - subtotal,
    });
    subtotal = rates.minimumCharge;
  }

  // 7. Validation discount (percent-based)
  if (hasValidation && detailedRates?.validationDiscount?.discountPercent) {
    const discount = subtotal * (detailedRates.validationDiscount.discountPercent / 100);
    lineItems.push({
      label: `Validation discount (${detailedRates.validationDiscount.discountPercent}% off)`,
      minutes: 0,
      amount: -discount,
    });
    subtotal -= discount;
  }

  // 8. Daily max cap
  let cap: number | undefined;
  if (rates.dailyMaxCap !== undefined && subtotal > rates.dailyMaxCap) {
    cap = rates.dailyMaxCap;
    subtotal = rates.dailyMaxCap;
  }

  return {
    totalMinutes,
    billableMinutes,
    lineItems,
    subtotal,
    cap,
    total: Math.max(0, subtotal),
    confidence,
    warnings,
  };
}

export function getVehicleRate(
  detailedRates: DetailedRates,
  vehicleType: PricingVehicleType,
): VehicleRate | null {
  return detailedRates[vehicleType] ?? null;
}

export function availableVehicleTypes(detailedRates: DetailedRates): PricingVehicleType[] {
  const types: PricingVehicleType[] = ['car', 'motorcycle', 'van', 'truck'];
  return types.filter((t) => detailedRates[t] !== undefined);
}
