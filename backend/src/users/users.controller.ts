import { Controller, Get, Patch, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { IsString, IsOptional } from 'class-validator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getCurrentUser(@Request() req) {
    return this.usersService.findById(req.user.id);
  }

  @Patch('me')
  async updateProfile(@Request() req, @Body() updateProfileDto: UpdateProfileDto) {
    return this.usersService.update(req.user.id, updateProfileDto);
  }

  @Get('search')
  async searchUsers(@Query('q') query: string, @Request() req) {
    if (!query) {
      return [];
    }
    return this.usersService.search(query, req.user.id);
  }
}
