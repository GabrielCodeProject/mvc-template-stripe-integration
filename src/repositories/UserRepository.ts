import { User } from "@/models/User";
import { prisma } from "@/lib/prisma";

export class UserRepository {
  private static instance: UserRepository;

  private constructor() {}

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  public async findAll(): Promise<User[]> {
    const users = await prisma.user.findMany({
      include: {
        accounts: true,
        sessions: true,
      },
    });
    return users.map(this.toDomainModel);
  }

  public async findById(id: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        accounts: true,
        sessions: true,
      },
    });
    return user ? this.toDomainModel(user) : null;
  }

  public async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
        sessions: true,
      },
    });
    return user ? this.toDomainModel(user) : null;
  }

  public async findByName(name: string): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: {
        name: {
          contains: name,
          mode: 'insensitive',
        },
      },
      include: {
        accounts: true,
        sessions: true,
      },
    });
    return users.map(this.toDomainModel);
  }

  public async emailExists(email: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return !!user;
  }

  public async create(userData: {
    email: string;
    name: string;
    emailVerified?: boolean;
    image?: string;
    phone?: string;
    twoFactorEnabled?: boolean;
    isActive?: boolean;
    role?: string;
    stripeCustomerId?: string;
    preferredCurrency?: string;
    timezone?: string;
  }): Promise<User> {
    const user = await prisma.user.create({
      data: userData,
      include: {
        accounts: true,
        sessions: true,
      },
    });
    return this.toDomainModel(user);
  }

  public async update(
    id: string,
    updates: Partial<{
      name: string;
      emailVerified: boolean;
      image: string;
      phone: string;
      twoFactorEnabled: boolean;
      isActive: boolean;
      role: string;
      stripeCustomerId: string;
      preferredCurrency: string;
      timezone: string;
      lastLoginAt: Date;
    }>
  ): Promise<User | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: updates,
        include: {
          accounts: true,
          sessions: true,
        },
      });
      return this.toDomainModel(user);
    } catch {
      // Handle case where user doesn't exist
      return null;
    }
  }

  public async delete(id: string): Promise<boolean> {
    try {
      await prisma.user.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  public async exists(id: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    return !!user;
  }

  public async count(): Promise<number> {
    return prisma.user.count();
  }

  // Helper method to convert Prisma model to domain model
  private toDomainModel(prismaUser: {
    id: string;
    email: string;
    name: string | null;
    emailVerified: boolean;
    image: string | null;
    phone: string | null;
    twoFactorEnabled: boolean;
    isActive: boolean;
    role: string;
    stripeCustomerId: string | null;
    preferredCurrency: string;
    timezone: string;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
    accounts?: any[];
    sessions?: any[];
  }): User {
    return new User({
      id: prismaUser.id,
      email: prismaUser.email,
      name: prismaUser.name || "",
      emailVerified: prismaUser.emailVerified,
      image: prismaUser.image,
      phone: prismaUser.phone ? parseInt(prismaUser.phone) : undefined,
      twoFactorEnabled: prismaUser.twoFactorEnabled,
      isActive: prismaUser.isActive,
      role: prismaUser.role,
      stripeCustomerId: prismaUser.stripeCustomerId,
      preferredCurrency: prismaUser.preferredCurrency,
      timezone: prismaUser.timezone,
      createdAt: prismaUser.createdAt,
      updatedAt: prismaUser.updatedAt,
      lastLoginAt: prismaUser.lastLoginAt,
      accounts: prismaUser.accounts || [],
      sessions: prismaUser.sessions || [],
    });
  }

  // Legacy method for backward compatibility
  public async updateUser(
    id: string,
    updates: Partial<{ name: string }>
  ): Promise<User | null> {
    return this.update(id, updates);
  }
}
