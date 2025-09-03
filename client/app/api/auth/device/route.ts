import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface DeviceAuthResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
}

interface TokenErrorResponse {
  error: string;
  error_description?: string;
}

// Helper function to provide troubleshooting tips
function getTroubleshootingTip(errorCode: string): string {
  switch (errorCode) {
    case 'invalid_client':
      return 'Create a "TV and Limited Input device" OAuth client in Google Cloud Console and use GOOGLE_DEVICE_CLIENT_ID/GOOGLE_DEVICE_CLIENT_SECRET';
    case 'expired_token':
      return 'The device code expires after a few minutes. Try restarting the authentication process.';
    case 'access_denied':
      return 'User cancelled or denied the authentication request. Try again.';
    case 'invalid_grant':
      return 'Device code may be expired, invalid, or already used. Restart the flow.';
    case 'slow_down':
      return 'Google is requesting slower polling. This is handled automatically.';
    case 'authorization_pending':
      return 'User needs to complete authentication at the verification URL.';
    default:
      return 'Check Google Cloud Console OAuth client configuration and ensure device flow is enabled.';
  }
}

// Initiate device authorization flow
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'initiate') {
      return handleDeviceAuthorization();
    }
    if (action === 'poll') {
      return handleTokenPolling(body);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Device auth error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function handleDeviceAuthorization() {
  // Use separate client ID for device flow if available, fallback to main client ID
  const clientId = process.env.GOOGLE_DEVICE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const scope = 'openid email profile';

  console.log('Device authorization attempt:', {
    hasClientId: !!clientId,
    clientIdLength: clientId?.length || 0,
    scope,
  });

  if (!clientId) {
    console.error('Missing GOOGLE_CLIENT_ID environment variable');
    return NextResponse.json({ 
      error: 'Google Client ID not configured',
      details: 'Please set the GOOGLE_CLIENT_ID environment variable'
    }, { status: 500 });
  }

  if (clientId === 'dummy') {
    console.error('GOOGLE_CLIENT_ID is set to dummy value');
    return NextResponse.json({ 
      error: 'Google Client ID not properly configured',
      details: 'GOOGLE_CLIENT_ID appears to be using a dummy value'
    }, { status: 500 });
  }

  try {
    console.log('Making request to Google device code endpoint...');
    const response = await fetch('https://oauth2.googleapis.com/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        scope: scope,
      }),
    });

    console.log('Google response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google device code error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
      });
      
      let errorDetails = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = JSON.parse(errorText);
        errorDetails = errorData.error_description || errorData.error || errorDetails;
      } catch {
        // Ignore JSON parse error, use status text
      }
      
      return NextResponse.json({ 
        error: 'Google device authorization failed',
        details: errorDetails,
        googleError: errorText
      }, { status: 500 });
    }

    const data: DeviceAuthResponse = await response.json();
    console.log('Device authorization successful:', {
      hasDeviceCode: !!data.device_code,
      userCode: data.user_code,
      verificationUri: data.verification_uri,
      verificationUriComplete: data.verification_uri_complete,
      expiresIn: data.expires_in,
      fullResponse: data,
    });
    
    // Fallback for verification_uri in case Google doesn't provide it
    const verificationUri = data.verification_uri || 'https://www.google.com/device';
    
    return NextResponse.json({
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: verificationUri,
      verification_uri_complete: data.verification_uri_complete,
      expires_in: data.expires_in,
      interval: data.interval,
    });
  } catch (error) {
    console.error('Device authorization error:', error);
    return NextResponse.json({ 
      error: 'Failed to initiate device authorization',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}

async function handleTokenPolling(body: { device_code?: string }) {
  try {
    const { device_code } = body;
    
    console.log('Token polling request received:', {
      hasDeviceCode: !!device_code,
      deviceCodeLength: device_code?.length || 0,
    });
    
    if (!device_code) {
      return NextResponse.json({ error: 'Device code required' }, { status: 400 });
    }

    // Use separate device credentials if available, fallback to main credentials
    const clientId = process.env.GOOGLE_DEVICE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DEVICE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

    console.log('Token exchange credentials:', {
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      clientIdLength: clientId?.length || 0,
      clientIdSuffix: clientId?.slice(-10) || 'none',
      usingDeviceCredentials: !!(process.env.GOOGLE_DEVICE_CLIENT_ID),
    });

    if (!clientId || !clientSecret) {
      console.error('Missing credentials for token exchange');
      return NextResponse.json({ error: 'Google credentials not configured' }, { status: 500 });
    }

    console.log('Making token exchange request to Google...');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        device_code: device_code,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });

    console.log('Google token response status:', response.status);
    const data: TokenResponse | TokenErrorResponse = await response.json();
    console.log('Google token response:', {
      status: response.status,
      hasAccessToken: !!(data as TokenResponse).access_token,
      error: (data as TokenErrorResponse).error,
      errorDescription: (data as TokenErrorResponse).error_description,
    });

    if (!response.ok) {
      const errorData = data as TokenErrorResponse;
      
      console.error('Google token exchange error:', {
        status: response.status,
        error: errorData.error,
        description: errorData.error_description,
      });
      
      // These are expected errors during polling
      if (errorData.error === 'authorization_pending') {
        console.log('Authorization still pending - continuing to poll');
        return NextResponse.json({ 
          status: errorData.error,
          message: errorData.error_description || 'Authorization pending - user needs to complete authentication'
        });
      }
      
      if (errorData.error === 'slow_down') {
        console.log('Google requested to slow down polling');
        return NextResponse.json({ 
          status: errorData.error,
          message: errorData.error_description || 'Slowing down polling as requested'
        });
      }
      
      // Handle specific error types with helpful messages
      let enhancedMessage = errorData.error_description || 'Authentication failed';
      
      if (errorData.error === 'expired_token') {
        enhancedMessage = 'Device code expired. Please restart the authentication process.';
      } else if (errorData.error === 'access_denied') {
        enhancedMessage = 'Access denied. User declined the authorization request.';
      } else if (errorData.error === 'invalid_client') {
        enhancedMessage = 'Invalid OAuth client. Make sure you are using a "TV and Limited Input device" client type.';
      } else if (errorData.error === 'invalid_grant') {
        enhancedMessage = 'Invalid device code or grant. The device code may be expired or already used.';
      }
      
      // Other errors (expired_token, access_denied, etc.)
      return NextResponse.json({ 
        error: errorData.error,
        message: enhancedMessage,
        googleError: errorData.error_description,
        troubleshooting: getTroubleshootingTip(errorData.error)
      }, { status: 400 });
    }

    const tokenData = data as TokenResponse;
    
    // Get user info using the access token
    const userInfoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();

    // Return the complete authentication data
    return NextResponse.json({
      status: 'success',
      tokens: {
        access_token: tokenData.access_token,
        id_token: tokenData.id_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
      },
      user: {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        image: userInfo.picture,
        email_verified: userInfo.email_verified,
      },
    });
  } catch (error) {
    console.error('Token polling error:', error);
    return NextResponse.json({ error: 'Failed to exchange device code for token' }, { status: 500 });
  }
}
