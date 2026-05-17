import { calculateParkingFee, availableVehicleTypes, PricingVehicleType } from '../pricing-engine';
import { DetailedRates, VehicleRate } from '../../types/parking';

const MAR_RATES: VehicleRate = {
  freeMinutes: 15,
  firstHours: 2,
  firstRate: 60,
  succeedingRate: 30,
  overnightCharge: 300,
  overnightCutoff: '22:00',
  minimumCharge: 30,
  dailyMaxCap: 500,
};

const DR: DetailedRates = {
  car: MAR_RATES,
  motorcycle: { freeMinutes: 15, firstHours: 2, firstRate: 30, succeedingRate: 15 },
  dataConfidence: 'medium',
};

function makeInput(
  arrivalHour: number,
  arrivalMinute: number,
  durationMinutes: number,
  overrides: Partial<typeof MAR_RATES> = {},
  date = new Date('2025-05-14'),
) {
  const arrival = new Date(date);
  arrival.setHours(arrivalHour, arrivalMinute, 0, 0);
  const exit = new Date(arrival.getTime() + durationMinutes * 60_000);
  return {
    arrivalTime: arrival,
    exitTime: exit,
    vehicleType: 'car' as PricingVehicleType,
    rates: { ...MAR_RATES, ...overrides },
    detailedRates: DR,
  };
}

describe('calculateParkingFee', () => {
  describe('grace period', () => {
    it('charges nothing when stay is within free minutes', () => {
      const result = calculateParkingFee(makeInput(10, 0, 10));
      expect(result.total).toBe(0);
      expect(result.billableMinutes).toBe(0);
    });

    it('correctly subtracts free minutes from billable time', () => {
      // 2h + 15min stay. 15min free = 2h billable = exactly firstHours
      const result = calculateParkingFee(makeInput(10, 0, 135));
      expect(result.billableMinutes).toBe(120);
      expect(result.total).toBe(60);
    });
  });

  describe('tiered rate', () => {
    it('charges firstRate for stay within first-hour window', () => {
      // 1h stay, 15min free → 45min billable (within 2h window)
      const result = calculateParkingFee(makeInput(10, 0, 75));
      expect(result.total).toBe(60);
    });

    it('adds succeeding rate for stay beyond firstHours', () => {
      // 3h stay, 15min free → 2h45min billable = 2h first + 45min succeeding (ceil to 1hr)
      const result = calculateParkingFee(makeInput(10, 0, 195));
      expect(result.total).toBe(90); // 60 + 1×30
    });

    it('ceil-rounds partial succeeding hours by default', () => {
      // 4h15min stay, 15min free → 4h billable = 2h first + 2h succeeding
      const result = calculateParkingFee(makeInput(10, 0, 255));
      expect(result.total).toBe(120); // 60 + 2×30
    });

    it('floor-rounds when partialHourRounding is floor', () => {
      // 2h45min stay, 15min free → 2h30min billable = 2h + 30min remaining
      // floor(30/60) = 0 succeeding intervals
      const result = calculateParkingFee(makeInput(10, 0, 165, { partialHourRounding: 'floor' }));
      expect(result.total).toBe(60);
    });

    it('warns when succeedingRate is missing and stay exceeds firstHours', () => {
      const result = calculateParkingFee(
        makeInput(10, 0, 300, { succeedingRate: undefined }),
      );
      expect(result.warnings.some((w) => w.includes('Succeeding rate unknown'))).toBe(true);
    });
  });

  describe('flat rate', () => {
    it('applies flat rate ignoring duration', () => {
      const result = calculateParkingFee(
        makeInput(10, 0, 300, { flatRate: 100, firstHours: undefined, firstRate: undefined, succeedingRate: undefined }),
      );
      expect(result.total).toBe(100);
    });

    it('applies flat rate only within window when window set', () => {
      // Arrival at 10AM, window 08:00-12:00 → applies
      const inWindow = calculateParkingFee(
        makeInput(10, 0, 120, { flatRate: 80, flatRateWindowStart: '08:00', flatRateWindowEnd: '12:00', firstHours: undefined, firstRate: undefined, succeedingRate: undefined }),
      );
      expect(inWindow.total).toBe(80);

      // Arrival at 14:00, outside window → tiered rate applies
      const outWindow = calculateParkingFee(
        makeInput(14, 0, 120, { flatRate: 80, flatRateWindowStart: '08:00', flatRateWindowEnd: '12:00', firstRate: 60 }),
      );
      expect(outWindow.total).toBe(60);
    });
  });

  describe('overnight charge', () => {
    it('adds overnight charge when exit crosses cutoff', () => {
      // Arrival 8PM (20:00), stay 4h → exit 12AM → crosses 22:00 cutoff
      const result = calculateParkingFee(makeInput(20, 0, 240));
      const overnightItem = result.lineItems.find((l) => l.label.includes('Overnight'));
      expect(overnightItem).toBeDefined();
      expect(overnightItem!.amount).toBe(300);
    });

    it('does not add overnight when stay ends before cutoff', () => {
      // Arrival 8PM, stay 1h → exit 9PM → does not cross 10PM cutoff
      const result = calculateParkingFee(makeInput(20, 0, 60));
      expect(result.lineItems.some((l) => l.label.includes('Overnight'))).toBe(false);
    });

    it('charges multiple overnights for multi-day stays', () => {
      // Arrival 8PM, stay 26h → crosses 10PM cutoff twice
      const result = calculateParkingFee(makeInput(20, 0, 26 * 60));
      const overnightItem = result.lineItems.find((l) => l.label.includes('Overnight'));
      expect(overnightItem?.amount).toBe(600); // 2 × 300
    });

    it('charges overnight when arrival is already past cutoff', () => {
      // Arrival 11PM, stay 3h → exit 2AM → already past 10PM
      const result = calculateParkingFee(makeInput(23, 0, 180));
      expect(result.lineItems.some((l) => l.label.includes('Overnight'))).toBe(true);
    });
  });

  describe('minimum charge', () => {
    it('applies minimum charge when computed cost is lower', () => {
      // 10min stay (under free period but with minimumCharge scenario)
      // Use rates without free minutes so it hits minimum
      const result = calculateParkingFee(
        makeInput(10, 0, 30, { freeMinutes: 0, firstHours: 2, firstRate: 60, minimumCharge: 30 }),
      );
      // 30min stay, no free → within first 2h → ₱60 (above minimum)
      // Change: very short stay under minimum
      const shortResult = calculateParkingFee(
        makeInput(10, 0, 30, { freeMinutes: 0, firstHours: 0, firstRate: 0, succeedingRate: 10, minimumCharge: 30 }),
      );
      expect(shortResult.total).toBeGreaterThanOrEqual(30);
    });
  });

  describe('daily max cap', () => {
    it('caps fee at dailyMaxCap', () => {
      // Very long stay to trigger succeeding rates well above cap
      const result = calculateParkingFee(makeInput(8, 0, 20 * 60)); // 20h
      expect(result.total).toBeLessThanOrEqual(500);
      expect(result.cap).toBe(500);
    });

    it('does not set cap when fee is under cap', () => {
      const result = calculateParkingFee(makeInput(10, 0, 75)); // short stay
      expect(result.cap).toBeUndefined();
    });
  });

  describe('validation discount', () => {
    it('adds extra free minutes with validation', () => {
      const input = {
        ...makeInput(10, 0, 120),
        hasValidation: true,
        detailedRates: {
          ...DR,
          validationDiscount: { discountMinutes: 60 },
        },
      };
      // Total: 2h, free: 15min + 60min validation = 75min, billable: 45min (within firstHours) → ₱60
      const result = calculateParkingFee(input);
      expect(result.billableMinutes).toBe(45);
      expect(result.total).toBe(60);
    });

    it('applies percent discount with validation', () => {
      const input = {
        ...makeInput(10, 0, 195), // would be ₱90 normally
        hasValidation: true,
        detailedRates: {
          ...DR,
          validationDiscount: { discountPercent: 20 },
        },
      };
      const result = calculateParkingFee(input);
      expect(result.total).toBeCloseTo(72); // 90 × 0.8
    });
  });

  describe('edge cases', () => {
    it('returns warning and zero total for zero or negative duration', () => {
      const arrival = new Date('2025-05-14T10:00:00');
      const exit = new Date('2025-05-14T09:00:00');
      const result = calculateParkingFee({
        arrivalTime: arrival,
        exitTime: exit,
        vehicleType: 'car',
        rates: MAR_RATES,
        detailedRates: DR,
      });
      expect(result.total).toBe(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('handles no rates gracefully (returns confidence none)', () => {
      const arrival = new Date('2025-05-14T10:00:00');
      const exit = new Date('2025-05-14T12:00:00');
      const result = calculateParkingFee({
        arrivalTime: arrival,
        exitTime: exit,
        vehicleType: 'car',
        rates: {},
        detailedRates: { dataConfidence: 'none' as any },
      });
      expect(result.total).toBe(0);
    });
  });
});

describe('availableVehicleTypes', () => {
  it('returns only vehicle types with defined rates', () => {
    const types = availableVehicleTypes(DR);
    expect(types).toContain('car');
    expect(types).toContain('motorcycle');
    expect(types).not.toContain('van');
    expect(types).not.toContain('truck');
  });
});
