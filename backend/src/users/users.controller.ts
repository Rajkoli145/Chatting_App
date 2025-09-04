import { Controller, Get, Patch, Body, UseGuards, Request, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() updateData: { name?: string; preferredLanguage?: string }) {
    return this.usersService.update(req.user.userId, updateData);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchUsers(@Query('q') query: string, @Request() req) {
    console.log('🔍 Search endpoint called with query:', query);
    console.log('🔍 Current user ID:', req.user?.userId);
    return this.usersService.search(query, req.user?.userId || '');
  }
}
