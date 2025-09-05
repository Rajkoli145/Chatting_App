import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    const jwtSecret = process.env.JWT_SECRET || '70a3e694ee581a02174d9a7133250b8635afcc4c6dbf60415c52eed9ebcd2f6653acb9615820be7633495fff8dde01cd90eae5a6ebc44e9d5e2d4cda33a15250';
    console.log('🔐 JWT Strategy: Initializing with secret:', jwtSecret ? 'Present' : 'Missing');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: any) {
    console.log('🔐 JWT Strategy: Validating payload:', payload);
    console.log('🔐 JWT Strategy: Using JWT_SECRET:', process.env.JWT_SECRET ? 'Present' : 'Missing');
    try {
      const user = await this.authService.validateUser(payload.sub);
      if (!user) {
        console.log('❌ JWT Strategy: No user returned from validateUser');
        throw new UnauthorizedException();
      }
      console.log('✅ JWT Strategy: User validated successfully:', user.name);
      return { sub: user._id.toString(), userId: user._id.toString(), mobile: user.mobile };
    } catch (error) {
      console.log('❌ JWT Strategy: Validation error:', error.message);
      throw new UnauthorizedException();
    }
  }
}
