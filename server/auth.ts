import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET: string = process.env.JWT_SECRET || process.env.SESSION_SECRET || "";
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET or SESSION_SECRET environment variable is required");
}
const TOKEN_EXPIRY = "30d";

export interface TokenPayload {
  userId: number;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as TokenPayload;
  } catch {
    return null;
  }
}
