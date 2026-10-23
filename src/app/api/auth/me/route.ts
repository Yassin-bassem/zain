import { NextResponse } from 'next/server';
import { getCurrentUser, isInitialSetupRequired } from '@/lib/auth';

export async function GET() {
  try {
    const isSetupRequired = await isInitialSetupRequired();
    const user = await getCurrentUser();

    return NextResponse.json({
      user,
      isInitialSetupRequired: isSetupRequired,
    });
  } catch (err: any) {
    console.error('Error in /api/auth/me:', err);
    return NextResponse.json({
      user: null,
      isInitialSetupRequired: false,
      error: err.message || 'Error checking auth status',
    });
  }
}
