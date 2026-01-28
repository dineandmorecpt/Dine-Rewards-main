import type { ILoyaltyStorage } from "../../storage";
import type { BaseUser } from "../../types";

export interface LoginParams {
  email: string;
  password: string;
}

export interface RegisterParams {
  email: string;
  password: string;
  name: string;
  lastName?: string;
  phone?: string;
  userType: string;
}

export interface IAuthService {
  login(params: LoginParams): Promise<{ user: BaseUser } | null>;
  register(params: RegisterParams): Promise<BaseUser>;
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: string, hash: string): Promise<boolean>;
  generateToken(length?: number): string;
}

export class AuthService implements IAuthService {
  constructor(
    private storage: ILoyaltyStorage,
    private bcrypt: {
      hash: (password: string, rounds: number) => Promise<string>;
      compare: (password: string, hash: string) => Promise<boolean>;
    }
  ) {}

  async login(params: LoginParams): Promise<{ user: BaseUser } | null> {
    const { email, password } = params;
    
    const user = await this.storage.getUserByEmail(email);
    if (!user) {
      return null;
    }

    const passwordValid = await this.verifyPassword(password, user.password);
    if (!passwordValid) {
      return null;
    }

    return { user };
  }

  async register(params: RegisterParams): Promise<BaseUser> {
    const { email, password, name, lastName, phone, userType } = params;

    const existingUser = await this.storage.getUserByEmail(email);
    if (existingUser) {
      throw new Error("A user with this email already exists");
    }

    const hashedPassword = await this.hashPassword(password);

    const user = await this.storage.createUser({
      email,
      password: hashedPassword,
      name,
      lastName: lastName || null,
      phone: phone || null,
      userType,
      analyticsId: this.generateAnalyticsId(),
    });

    return user;
  }

  async hashPassword(password: string): Promise<string> {
    return this.bcrypt.hash(password, 12);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    if (hash.startsWith("$2")) {
      return this.bcrypt.compare(password, hash);
    }
    return password === hash;
  }

  generateToken(length: number = 64): string {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let token = "";
    for (let i = 0; i < length; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private generateAnalyticsId(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let id = "";
    for (let i = 0; i < 12; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }
}
