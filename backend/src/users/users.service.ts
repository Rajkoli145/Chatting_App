import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async create(userData: { mobile: string; name: string; preferredLanguage: string }): Promise<User> {
    const user = new this.userModel(userData);
    return user.save();
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByMobile(mobile: string): Promise<User> {
    return this.userModel.findOne({ mobile });
  }

  async update(id: string, updateData: Partial<User>): Promise<User> {
    console.log(`🔄 Updating user ${id} with data:`, updateData);
    const updatedUser = await this.userModel.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    
    console.log(`✅ User updated successfully:`, updatedUser);
    return updatedUser;
  }

  async search(query: string, currentUserId: string): Promise<User[]> {
    try {
      console.log(`🔍 Searching users with query: "${query}", excluding user ID: ${currentUserId}`);
      
      // First, let's see all users in database
      const allUsers = await this.userModel.find({}).exec();
      console.log(`📊 Total users in database: ${allUsers.length}`);
      allUsers.forEach(user => {
        console.log(`   - ${user.name} (${user.mobile}) [ID: ${user._id}]`);
      });
      
      const users = await this.userModel.find({
        $and: [
          {
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { mobile: { $regex: query, $options: 'i' } },
            ],
          },
          { _id: { $ne: currentUserId } } // Exclude current user from results
        ]
      }).limit(20).exec();
      
      console.log(`🎯 Search results: ${users.length} users found`);
      users.forEach(user => {
        console.log(`   ✅ ${user.name} (${user.mobile})`);
      });
      
      return users;
    } catch (error) {
      console.error('❌ Error in user search:', error);
      throw error;
    }
  }

  async updateLastSeen(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { lastSeen: new Date() });
  }
}
