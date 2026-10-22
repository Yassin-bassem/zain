import { NextResponse } from 'next/server';
import { getCurrentUser, isInitialSetupRequired } from '@/lib/auth';

export async function GET() {
  const isSetupRequired = await isInitialSetupRequired();
  const user = await getCurrentUser();

  return NextResponse.json({
    user,
    isInitialSetupRequired: isSetupRequired,
  });
}
