import { NextFunction, Request, Response } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { getOrCreateOwner } from '../db/queries.ts';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface OwnerRecord {
  id: number;
  uid: string;
  email: string;
  ownerName: string | null;
  gymName: string | null;
  mobileNumber: string | null;
  isOnboarded: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  owner?: OwnerRecord;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const owner = await getOrCreateOwner(
      decodedToken.uid,
      decodedToken.email || '',
      typeof decodedToken.name === 'string' ? decodedToken.name : null
    );
    req.owner = owner;
    next();
  } catch (error) {
    console.error('Authentication or owner sync failed:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
