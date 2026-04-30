import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { MailService } from './mail.service';
import { OtpVerification } from './entities/otp-verification.entity';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(OtpVerification)
    private readonly otpRepo: Repository<OtpVerification>,
  ) {}

  // ─── Registration ────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.usersService.findByEmail(dto.email);

    if (existing && existing.emailVerified) {
      throw new ConflictException('Email already registered. Please sign in.');
    }

    const userData: Record<string, unknown> = {
      email: dto.email,
      name: dto.name,
      mobileNumber: dto.mobileNumber ?? null,
      age: dto.age,
      vehicleType: dto.vehicleType,
      emailVerified: false,
    };

    if (dto.password) {
      userData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (existing) {
      await this.usersService.update(existing.id, userData as any);
    } else {
      await this.usersService.create(userData as any);
    }

    await this._generateAndSendOtp(dto.email);
    return { message: 'Verification code sent to your email.' };
  }

  // ─── OTP Login ───────────────────────────────────────────────────────────────

  async sendOtp(email: string): Promise<{ message: string }> {
    await this._generateAndSendOtp(email);
    return { message: 'Code sent. Check your email.' };
  }

  async verifyOtp(
    email: string,
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; isNewUser: boolean }> {
    const otp = await this.otpRepo.findOne({
      where: { email, code, used: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp) throw new UnauthorizedException('Invalid or expired code.');

    if (new Date() > otp.expiresAt) {
      await this.otpRepo.update(otp.id, { used: true });
      throw new UnauthorizedException('Code expired. Request a new one.');
    }

    await this.otpRepo.update(otp.id, { used: true });

    let user = await this.usersService.findByEmail(email);
    let isNewUser = false;

    if (!user) {
      // OTP login with no prior account — create minimal user
      user = await this.usersService.create({ email, emailVerified: true } as any);
      isNewUser = true;
    } else if (!user.emailVerified) {
      // Completing registration via OTP
      await this.usersService.update(user.id, { emailVerified: true } as any);
      user.emailVerified = true;
    }

    return { ...this.signTokens(user.id, user.email), isNewUser };
  }

  // ─── Password Login ───────────────────────────────────────────────────────────

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.usersService.findByEmail(email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('No password set for this account. Please use OTP login.');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Incorrect password.');

    if (!user.emailVerified) {
      throw new UnauthorizedException('Email not verified. Please complete registration.');
    }

    return this.signTokens(user.id, user.email);
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

  private async _generateAndSendOtp(email: string) {
    await this.otpRepo.update({ email, used: false }, { used: true });
    const code = Math.floor(100_000 + Math.random() * 900_000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await this.otpRepo.save(this.otpRepo.create({ email, code, expiresAt, used: false }));
    await this.mailService.sendOtp(email, code);
  }

  private signTokens(userId: string, email: string) {
    const payload = { sub: userId, email };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        secret: process.env.JWT_REFRESH_SECRET ?? 'dev_refresh_secret',
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as any,
      }),
    };
  }
}
