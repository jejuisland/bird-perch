import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { MailService } from './mail.service';
import { OtpVerification } from './entities/otp-verification.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(OtpVerification)
    private readonly otpRepo: Repository<OtpVerification>,
  ) {}

  async sendOtp(email: string): Promise<{ message: string }> {
    // Invalidate previous unused OTPs for this email
    await this.otpRepo.update({ email, used: false }, { used: true });

    const code = Math.floor(100_000 + Math.random() * 900_000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.otpRepo.save(this.otpRepo.create({ email, code, expiresAt, used: false }));

    await this.mailService.sendOtp(email, code);

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
      user = await this.usersService.create({ email });
      isNewUser = true;
    }

    return { ...this.signTokens(user.id, user.email), isNewUser };
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
