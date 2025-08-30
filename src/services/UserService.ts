import { User } from "@/models/User";
import { UserRepository } from "@/repositories/UserRepository";

export class UserService {
  private userRepository: UserRepository;
  private static instance: UserService;

  private constructor() {
    this.userRepository = UserRepository.getInstance();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public async getAllUsers(): Promise<User[]> {
    return await this.userRepository.findAll();
  }

  public async getUserById(id: string): Promise<User | null> {
    return await this.userRepository.findById(id);
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findByEmail(email);
  }

  public async searchUsersByName(name: string): Promise<User[]> {
    return await this.userRepository.findByName(name);
  }

  public async createUser(name: string, email: string): Promise<User> {
    if (await this.userRepository.emailExists(email)) {
      throw new Error(`User with email ${email} already exists`);
    }

    const id = this.generateId();
    const user = new User({ id, name, email });

    const validation = user.validate();
    if (!validation.isValid) {
      throw new Error(
        `User validation failed: ${validation.errors.join(", ")}`
      );
    }

    // The create method expects user data, not a User instance
    const userData = {
      email: user.email,
      name: user.name,
      // Add default values for required fields
      emailVerified: false,
      isActive: true,
      role: "user",
      preferredCurrency: "USD",
      timezone: "UTC",
      twoFactorEnabled: false,
    };

    return await this.userRepository.create(userData);
  }

  public async updateUser(
    id: string,
    updates: Partial<{ name: string; email: string }>
  ): Promise<User> {
    const user = await this.userRepository.updateUser(id, updates);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }

    const validation = user.validate();
    if (!validation.isValid) {
      throw new Error(
        `User validation failed: ${validation.errors.join(", ")}`
      );
    }

    return user;
  }

  public async deleteUser(id: string): Promise<boolean> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return await this.userRepository.delete(id);
  }

  public async getTotalUsers(): Promise<number> {
    return await this.userRepository.count();
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
