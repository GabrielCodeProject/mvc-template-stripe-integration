type DateTime = Date;

interface Account {
  id: string;
  userId: string;
  type: string;
  provider: string;
  providerAccountId: string;
  refresh_token?: string;
  access_token?: string;
  expires_at?: number;
  token_type?: string;
  scope?: string;
  id_token?: string;
  session_state?: string;
}

interface Session {
  id: string;
  sessionToken: string;
  userId: string;
  expires: DateTime;
}

interface UserConstructorParams {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  image?: string;
  phone?: number;
  twoFactorEnabled?: boolean;
  isActive?: boolean;
  role?: string;
  stripeCustomerId?: string;
  preferredCurrency?: string;
  timezone?: string;
  createdAt?: DateTime;
  updatedAt?: DateTime;
  lastLoginAt?: DateTime;
  accounts?: Account[];
  sessions?: Session[];
}

interface UserJSON {
  id: string;
  email: string;
  name: string;
  emailVerified?: boolean;
  image?: string;
  phone?: number;
  twoFactorEnabled?: boolean;
  isActive?: boolean;
  role?: string;
  stripeCustomerId?: string;
  preferredCurrency?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  accounts?: Account[];
  sessions?: Session[];
}

export class User {
  private _id: string;
  protected _email: string;
  protected _name: string;
  private _emailVerified: boolean;
  private _image: string | undefined;
  private _phone: number | undefined;
  protected _twoFactorEnabled: boolean;
  private _isActive: boolean;
  private _role: string;
  private _stripeCustomerId: string | undefined;
  private _preferredCurrency: string;
  private _timezone: string;
  private _createdAt: DateTime;
  protected _updatedAt: DateTime;
  private _lastLoginAt: DateTime | undefined;
  private _accounts: Account[];
  private _sessions: Session[];

  constructor(params: UserConstructorParams) {
    this._id = params.id;
    this._email = params.email;
    this._name = params.name;
    this._emailVerified = params.emailVerified ?? false;
    this._twoFactorEnabled = params.twoFactorEnabled ?? false;
    this._isActive = params.isActive ?? false;
    this._role = params.role ?? "CUSTOMER";
    this._preferredCurrency = params.preferredCurrency ?? "CAD";
    this._timezone = params.timezone ?? "UTC";
    this._createdAt = params.createdAt ?? new Date();
    this._updatedAt = params.updatedAt ?? new Date();
    this._image = params.image;
    this._phone = params.phone;
    this._stripeCustomerId = params.stripeCustomerId;
    this._lastLoginAt = params.lastLoginAt;
    this._accounts = params.accounts ?? [];
    this._sessions = params.sessions ?? [];
  }

  get id(): string {
    return this._id;
  }

  get email(): string {
    return this._email;
  }

  get name(): string {
    return this._name;
  }

  set name(value: string) {
    this._name = value;
    this._updatedAt = new Date();
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  set emailVerified(value: boolean) {
    this._emailVerified = value;
  }

  get image(): string | undefined {
    return this._image;
  }

  set image(value: string | undefined) {
    this._image = value;
  }

  get phone(): number | undefined {
    return this._phone;
  }

  set phone(value: number | undefined) {
    this._phone = value;
  }

  get twoFactorEnabled(): boolean {
    return this._twoFactorEnabled;
  }

  set twoFactorEnabled(value: boolean) {
    this._twoFactorEnabled = value;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  set isActive(value: boolean) {
    this._isActive = value;
  }

  get role(): string {
    return this._role;
  }

  set role(value: string) {
    this._role = value;
  }

  get stripeCustomerId(): string | undefined {
    return this._stripeCustomerId;
  }

  set stripeCustomerId(value: string | undefined) {
    this._stripeCustomerId = value;
  }

  get preferredCurrency(): string {
    return this._preferredCurrency;
  }

  set preferredCurrency(value: string) {
    this._preferredCurrency = value;
  }

  get timezone(): string {
    return this._timezone;
  }

  set timezone(value: string) {
    this._timezone = value;
  }

  get createdAt(): DateTime {
    return this._createdAt;
  }

  set createdAt(value: DateTime) {
    this._createdAt = value;
  }

  get updatedAt(): DateTime {
    return this._updatedAt;
  }

  set updatedAt(value: DateTime) {
    this._updatedAt = value;
  }

  get lastLoginAt(): DateTime | undefined {
    return this._lastLoginAt;
  }

  set lastLoginAt(value: DateTime | undefined) {
    this._lastLoginAt = value;
  }

  get accounts(): Account[] {
    return this._accounts;
  }

  set accounts(value: Account[]) {
    this._accounts = value;
  }

  get sessions(): Session[] {
    return this._sessions;
  }

  set sessions(value: Session[]) {
    this._sessions = value;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this._name || this._name.trim().length === 0) {
      errors.push("Name is required");
    }

    if (!this._email || !this.isValidEmail(this._email)) {
      errors.push("Valid email is required");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      email: this._email,
      name: this._name,
      emailVerified: this._emailVerified,
      image: this._image,
      phone: this._phone,
      twoFactorEnabled: this._twoFactorEnabled,
      isActive: this._isActive,
      role: this._role,
      stripeCustomerId: this._stripeCustomerId,
      preferredCurrency: this._preferredCurrency,
      timezone: this._timezone,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      lastLoginAt: this._lastLoginAt ? this._lastLoginAt.toISOString() : null,
    };
  }

  public static fromJSON(json: UserJSON): User {
    const user = new User({
      id: json.id,
      email: json.email,
      name: json.name,
      emailVerified: json.emailVerified,
      twoFactorEnabled: json.twoFactorEnabled,
      isActive: json.isActive,
      role: json.role,
      stripeCustomerId: json.stripeCustomerId,
      preferredCurrency: json.preferredCurrency,
      timezone: json.timezone,
      createdAt: json.createdAt ? new Date(json.createdAt) : undefined,
      updatedAt: json.updatedAt ? new Date(json.updatedAt) : undefined,
      lastLoginAt: json.lastLoginAt ? new Date(json.lastLoginAt) : undefined,
      image: json.image,
      phone: json.phone,
      accounts: json.accounts,
      sessions: json.sessions,
    });

    return user;
  }
}
