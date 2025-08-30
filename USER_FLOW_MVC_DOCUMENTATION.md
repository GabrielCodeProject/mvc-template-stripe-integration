# User Flow MVC Architecture Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture Pattern](#architecture-pattern)
3. [Layer Breakdown](#layer-breakdown)
4. [Why MVC Works](#why-mvc-works)
5. [Implementation Flow](#implementation-flow)
6. [Code Examples](#code-examples)
7. [Benefits](#benefits)
8. [Future Database Integration](#future-database-integration)

## Overview

This documentation describes the Model-View-Controller (MVC) architecture implementation for the User management flow in this Next.js application. The pattern provides a clean separation of concerns, making the codebase maintainable, testable, and scalable.

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                         VIEW LAYER                          │
│                    React Components                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ UserManager  │  │   UserList   │  │ UserEditForm │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────┬───────────────────────────────┘
                              │ HTTP Requests
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CONTROLLER LAYER                       │
│                     API Route Handlers                      │
│              /api/users/route.ts (GET, POST)               │
│              /api/users/[id]/route.ts (PUT, DELETE)        │
└─────────────────────────────┬───────────────────────────────┘
                              │ Business Logic Calls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                         │
│                   Business Logic Manager                    │
│                      UserService.ts                         │
│         • Validation • Business Rules • ID Generation       │
└─────────────────────────────┬───────────────────────────────┘
                              │ Data Operations
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     REPOSITORY LAYER                        │
│                    Data Access Layer                        │
│                    UserRepository.ts                        │
│        • CRUD Operations • Query Methods • Filtering        │
└─────────────────────────────┬───────────────────────────────┘
                              │ Entity Management
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        MODEL LAYER                          │
│                     Domain Entities                         │
│                        User.ts                              │
│      • Data Structure • Validation • Serialization          │
└─────────────────────────────────────────────────────────────┘
```

## Layer Breakdown

### 1. Model Layer (`/src/models/User.ts`)
**Purpose:** Defines the core data structure and domain logic

- **Responsibilities:**
  - Define User entity properties and types
  - Encapsulate data with private fields and public getters/setters
  - Provide validation methods
  - Handle serialization/deserialization (toJSON/fromJSON)

### 2. Repository Layer (`/src/repositories/UserRepository.ts`)
**Purpose:** Abstracts data access and persistence

- **Responsibilities:**
  - Implement CRUD operations (Create, Read, Update, Delete)
  - Provide query methods (findByEmail, findByName)
  - Manage data storage (currently in-memory, future: Prisma/database)
  - Extend BaseRepository for common functionality

### 3. Service Layer (`/src/services/UserService.ts`)
**Purpose:** Contains business logic and orchestrates operations

- **Responsibilities:**
  - Implement business rules (email uniqueness, validation)
  - Coordinate between repository and controllers
  - Generate unique IDs
  - Handle complex operations that involve multiple entities

### 4. Controller Layer (`/src/app/api/users/route.ts`)
**Purpose:** Handle HTTP requests and responses

- **Responsibilities:**
  - Parse request data
  - Call appropriate service methods
  - Format responses
  - Handle errors and status codes
  - Implement RESTful endpoints

### 5. View Layer (`/src/components/userManager/`)
**Purpose:** Present data and handle user interactions

- **Components:**
  - `UserManager.tsx`: Main orchestrator component
  - `UserList.tsx`: Display users in table format
  - `UserEditForm.tsx`: Handle user creation/editing

## Why MVC Works

### 1. Separation of Concerns
Each layer has a single, well-defined responsibility. This makes the code easier to understand, maintain, and test.

### 2. Testability
Each layer can be tested independently:
- Models: Unit test validation and serialization
- Repositories: Test data operations
- Services: Test business logic with mocked repositories
- Controllers: Test HTTP handling with mocked services
- Views: Test UI components with mocked API calls

### 3. Scalability
New features can be added without affecting existing code:
- Add new fields to User model
- Implement new query methods in repository
- Add business rules in service layer
- Create new API endpoints
- Build new UI components

### 4. Maintainability
Changes are localized to specific layers:
- Database changes only affect repository
- Business rule changes only affect service
- UI changes only affect view components

## Implementation Flow

### Creating a New User

```
1. User fills form in UserEditForm component
2. Form validates input client-side
3. UserManager sends POST request to /api/users
4. Controller receives request, extracts data
5. Controller calls UserService.createUser()
6. Service validates business rules (email uniqueness)
7. Service creates User entity with generated ID
8. Service calls UserRepository.create()
9. Repository stores user (memory/database)
10. Response flows back through layers to UI
```

## Code Examples

### Model Example - User Entity with Encapsulation

```typescript
// src/models/User.ts
export class User {
  private _id: string;
  private _email: string;
  private _name: string;
  private _updatedAt: DateTime;

  constructor(params: UserConstructorParams) {
    this._id = params.id;
    this._email = params.email;
    this._name = params.name;
    this._updatedAt = params.updatedAt ?? new Date();
  }

  // Getter with encapsulation
  get name(): string {
    return this._name;
  }

  // Setter with automatic update tracking
  set name(value: string) {
    this._name = value;
    this._updatedAt = new Date();
  }

  // Domain validation logic
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
}
```

### Repository Example - Data Access Pattern

```typescript
// src/repositories/UserRepository.ts
export class UserRepository extends BaseRepository<User> {
  // Singleton pattern for single source of truth
  private static instance: UserRepository;
  
  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  // Custom query method
  public findByEmail(email: string): User | null {
    return this.findFirst((user) => user.email === email);
  }

  // Search functionality
  public findByName(name: string): User[] {
    const searchName = name.toLowerCase();
    return this.findWhere((user) =>
      user.name.toLowerCase().includes(searchName)
    );
  }

  // Future: Replace with Prisma
  // public async findByEmail(email: string): Promise<User | null> {
  //   const userData = await prisma.user.findUnique({
  //     where: { email }
  //   });
  //   return userData ? User.fromJSON(userData) : null;
  // }
}
```

### Service Example - Business Logic Layer

```typescript
// src/services/UserService.ts
export class UserService {
  private userRepository: UserRepository;

  public createUser(name: string, email: string): User {
    // Business rule: Email must be unique
    if (this.userRepository.emailExists(email)) {
      throw new Error(`User with email ${email} already exists`);
    }

    // Create entity with generated ID
    const id = this.generateId();
    const user = new User({ id, name, email });

    // Validate entity
    const validation = user.validate();
    if (!validation.isValid) {
      throw new Error(
        `User validation failed: ${validation.errors.join(", ")}`
      );
    }

    // Persist through repository
    return this.userRepository.create(user);
  }

  private generateId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
```

### Controller Example - HTTP Request Handling

```typescript
// src/app/api/users/route.ts
import { UserService } from "@/services/UserService";
import { NextRequest, NextResponse } from "next/server";

const userService = UserService.getInstance();

export async function POST(request: NextRequest) {
  try {
    // Parse request
    const body = await request.json();
    const { name, email } = body;

    // Validate input
    if (!name || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, email",
        },
        { status: 400 }
      );
    }

    // Call service layer
    const user = userService.createUser(name, email);

    // Return formatted response
    return NextResponse.json(
      {
        success: true,
        data: user.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    // Error handling
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 400 }
    );
  }
}
```

### View Example - React Component Integration

```typescript
// src/components/userManager/UserManager.tsx
export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);

  // Fetch users through API (Controller layer)
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const result = await response.json();
      
      if (result.success) {
        // Convert JSON to User entities
        const userInstances = result.data.map((u: Record<string, string>) => 
          User.fromJSON(u)
        );
        setUsers(userInstances);
      }
    } catch (err) {
      setError('Failed to fetch users');
    }
  };

  // Handle user creation
  const handleSave = async (userData: Partial<{name: string; email: string}>) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      
      const result = await response.json();
      if (result.success) {
        await fetchUsers(); // Refresh list
      }
    } catch (err) {
      alert('Failed to save user');
    }
  };
}
```

## Benefits

### 1. Clean Architecture
- Each layer has clear boundaries
- Dependencies flow in one direction (View → Controller → Service → Repository → Model)
- No circular dependencies

### 2. Easy Testing
```typescript
// Example: Testing UserService
describe('UserService', () => {
  it('should create a user with unique email', () => {
    const mockRepository = {
      emailExists: jest.fn().mockReturnValue(false),
      create: jest.fn().mockImplementation(user => user)
    };
    
    const service = new UserService(mockRepository);
    const user = service.createUser('John', 'john@example.com');
    
    expect(user.name).toBe('John');
    expect(mockRepository.create).toHaveBeenCalled();
  });
});
```

### 3. Flexibility
- Easy to swap implementations (e.g., switch from in-memory to database)
- Can add caching, logging, or monitoring at any layer
- Support multiple data sources or APIs

### 4. Code Reusability
- BaseRepository provides common CRUD operations
- Services can be used by multiple controllers
- Models can be shared across different features

## Future Database Integration

### Current Implementation (In-Memory)
```typescript
// UserRepository.ts
export class UserRepository extends BaseRepository<User> {
  protected items: User[] = []; // In-memory storage
  
  public findByEmail(email: string): User | null {
    return this.findFirst((user) => user.email === email);
  }
}
```

### Future Implementation (Prisma)
```typescript
// UserRepository.ts with Prisma
import { PrismaClient } from '@prisma/client';

export class UserRepository {
  private prisma: PrismaClient;
  
  constructor() {
    this.prisma = new PrismaClient();
  }
  
  public async findByEmail(email: string): Promise<User | null> {
    const userData = await this.prisma.user.findUnique({
      where: { email },
      include: {
        accounts: true,
        sessions: true
      }
    });
    
    return userData ? User.fromJSON(userData) : null;
  }
  
  public async create(user: User): Promise<User> {
    const userData = await this.prisma.user.create({
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        // ... other fields
      }
    });
    
    return User.fromJSON(userData);
  }
}
```

### Migration Strategy
1. **Install Prisma**: `npm install @prisma/client prisma`
2. **Define Schema**: Create `prisma/schema.prisma`
3. **Update Repository**: Replace in-memory operations with Prisma calls
4. **No Changes Required**: Service, Controller, and View layers remain unchanged

## Conclusion

This MVC architecture provides a robust foundation for building scalable applications. The clear separation of concerns makes the codebase:
- **Maintainable**: Easy to locate and fix issues
- **Testable**: Each layer can be tested independently
- **Scalable**: New features can be added without breaking existing code
- **Flexible**: Easy to swap implementations or add new capabilities

The pattern is particularly powerful in Next.js applications where:
- API routes serve as natural controllers
- React components provide the view layer
- TypeScript classes enable proper OOP design
- The architecture supports both SSR and client-side rendering