import { Injectable } from '@nestjs/common';
import { DetailedRates, VehicleRate } from '@perch/shared';

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${m.toString().padStart(2, '0')}${suffix}`;
}

function formatVehicleRate(rate: VehicleRate, vehicleName: string): string {
  const parts: string[] = [];

  if (rate.freeMinutes) {
    parts.push(`Free ${rate.freeMinutes}min`);
  }
  if (rate.validationMinutes) {
    parts.push(`Free ${rate.validationMinutes}min w/ receipt`);
  }

  if (rate.flatRate != null) {
    let flatStr = `₱${rate.flatRate} flat`;
    const start = rate.flatRateWindowStart;
    const end = rate.flatRateWindowEnd;
    if (start && end) {
      flatStr += ` (${formatTime(start)}–${formatTime(end)})`;
    }
    parts.push(flatStr);
  } else {
    if (rate.firstHours != null && rate.firstRate != null) {
      parts.push(`₱${rate.firstRate} first ${rate.firstHours}h`);
    }
    if (rate.succeedingRate != null) {
      parts.push(`₱${rate.succeedingRate}/hr`);
    }
  }

  if (rate.overnightCharge != null) {
    let ovStr = `₱${rate.overnightCharge} overnight`;
    const start = rate.overnightWindowStart;
    const end = rate.overnightWindowEnd;
    if (start && end) {
      ovStr += ` (${formatTime(start)}–${formatTime(end)})`;
    }
    parts.push(ovStr);
  }

  if (rate.minimumCharge != null) {
    parts.push(`min ₱${rate.minimumCharge}`);
  }

  return `${vehicleName}: ${parts.join(' · ')}`;
}

@Injectable()
export class RateSummaryService {
  generate(d: DetailedRates): string {
    const lines: string[] = [];

    if (d.car) {
      lines.push(formatVehicleRate(d.car, 'Car'));
    }

    if (d.motorcycle) {
      const motoStr = formatVehicleRate(d.motorcycle, 'Moto');
      // Skip motorcycle line if identical to car (avoids redundant output)
      const carStr = d.car ? formatVehicleRate(d.car, 'Moto') : null;
      if (motoStr !== carStr) {
        lines.push(motoStr);
      }
    }

    if (d.van) {
      lines.push(formatVehicleRate(d.van, 'Van'));
    }

    if (d.truck) {
      lines.push(formatVehicleRate(d.truck, 'Truck'));
    }

    if (d.lostTicketFee != null) {
      lines.push(`Lost ticket: ₱${d.lostTicketFee}`);
    }

    if (d.damagedCardFee != null) {
      lines.push(`Damaged card: ₱${d.damagedCardFee}`);
    }

    return lines.join(' / ');
  }

  /**
   * Detect conflicting rate fields (both flatRate and firstRate set on the same vehicle).
   * Returns 'low' confidence when conflicts are detected, 'medium' otherwise.
   */
  inferConfidence(d: DetailedRates): 'low' | 'medium' {
    for (const rate of [d.car, d.motorcycle, d.van, d.truck]) {
      if (!rate) continue;
      if (rate.flatRate != null && rate.firstRate != null) return 'low';
    }
    return 'medium';
  }
}
