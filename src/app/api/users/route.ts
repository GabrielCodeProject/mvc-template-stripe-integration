import { UserService } from "@/services/UserService";
import { NextRequest, NextResponse } from "next/server";

const userService = UserService.getInstance();

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    let users;

    if (search) {
      users = await userService.searchUsersByName(search);
    } else {
      users = await userService.getAllUsers();
    }

    return NextResponse.json({
      success: true,
      data: users.map((u) => u.toJSON()),
      count: users.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email } = body;

    if (!name || !email) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, email",
        },
        { status: 400 }
      );
    }

    const user = await userService.createUser(name, email);

    return NextResponse.json(
      {
        success: true,
        data: user.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 400 }
    );
  }
}
