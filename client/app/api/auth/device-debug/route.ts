import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Debug endpoint to check environment variables and Google OAuth setup
export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const deviceClientId = process.env.GOOGLE_DEVICE_CLIENT_ID;
  const deviceClientSecret = process.env.GOOGLE_DEVICE_CLIENT_SECRET;
  
  // Use device credentials if available, fallback to main credentials
  const activeClientId = deviceClientId || clientId;
  const activeClientSecret = deviceClientSecret || clientSecret;
  
  const diagnostics = {
    environment: {
      // Main OAuth credentials (for standard flow)
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId ? clientId.length : 0,
      clientSecretLength: clientSecret ? clientSecret.length : 0,
      clientIdSuffix: clientId ? clientId.slice(-10) : 'not set',
      
      // Device-specific credentials (for device flow)
      hasDeviceClientId: !!deviceClientId,
      hasDeviceClientSecret: !!deviceClientSecret,
      deviceClientIdLength: deviceClientId ? deviceClientId.length : 0,
      deviceClientSecretLength: deviceClientSecret ? deviceClientSecret.length : 0,
      deviceClientIdSuffix: deviceClientId ? deviceClientId.slice(-10) : 'not set',
      
      // Active credentials for device flow
      activeClientIdLength: activeClientId ? activeClientId.length : 0,
      activeClientIdSuffix: activeClientId ? activeClientId.slice(-10) : 'not set',
    },
    oauth: {
      deviceCodeEndpoint: 'https://oauth2.googleapis.com/device/code',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      userInfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
    },
    recommendations: [] as string[]
  };

  // Add specific recommendations based on findings
  if (!activeClientId) {
    diagnostics.recommendations.push('Set GOOGLE_DEVICE_CLIENT_ID or GOOGLE_CLIENT_ID environment variable');
  }
  
  if (!activeClientSecret) {
    diagnostics.recommendations.push('Set GOOGLE_DEVICE_CLIENT_SECRET or GOOGLE_CLIENT_SECRET environment variable');
  }

  if (!deviceClientId && !deviceClientSecret) {
    diagnostics.recommendations.push('⚠️ For device flow: Create a separate "TV and Limited Input device" OAuth client and set GOOGLE_DEVICE_CLIENT_ID and GOOGLE_DEVICE_CLIENT_SECRET');
  }

  if (activeClientId && !activeClientId.includes('.apps.googleusercontent.com')) {
    diagnostics.recommendations.push('Verify client ID format (should end with .apps.googleusercontent.com)');
  }

  if (deviceClientId && !deviceClientSecret) {
    diagnostics.recommendations.push('GOOGLE_DEVICE_CLIENT_SECRET is missing (required with GOOGLE_DEVICE_CLIENT_ID)');
  }

  if (!deviceClientId && deviceClientSecret) {
    diagnostics.recommendations.push('GOOGLE_DEVICE_CLIENT_ID is missing (required with GOOGLE_DEVICE_CLIENT_SECRET)');
  }

  return NextResponse.json(diagnostics);
}

// Test device code flow configuration
export async function POST() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const deviceClientId = process.env.GOOGLE_DEVICE_CLIENT_ID;
  const activeClientId = deviceClientId || clientId;
  
  if (!activeClientId) {
    return NextResponse.json({ 
      error: 'Google Client ID not configured',
      fix: 'Add GOOGLE_DEVICE_CLIENT_ID (preferred) or GOOGLE_CLIENT_ID to your environment variables',
      note: 'For device flow, you need a "TV and Limited Input device" OAuth client'
    }, { status: 500 });
  }

  try {
    // Test the device code request without making the actual call
    const testPayload = {
      client_id: activeClientId,
      scope: 'openid email profile',
    };

    return NextResponse.json({ 
      message: 'Environment looks good for device flow',
      usingDeviceCredentials: !!deviceClientId,
      payload: testPayload,
      endpoint: 'https://oauth2.googleapis.com/device/code',
      clientType: deviceClientId ? 'TV/Limited Input Device (correct for device flow)' : 'Standard OAuth (may not work for device flow)',
      recommendation: deviceClientId ? 'Using dedicated device client - perfect!' : 'Consider creating a separate TV client for device flow'
    });
  } catch (error) {
    return NextResponse.json({ 
      error: 'Configuration test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
