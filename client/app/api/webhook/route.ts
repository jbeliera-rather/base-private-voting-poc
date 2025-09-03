import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Webhook handler for Farcaster Frame events
 * Handles authentication and other frame interactions
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log the webhook event for debugging
    console.log('Farcaster webhook received:', {
      type: body.type,
      timestamp: new Date().toISOString(),
      data: body
    });

    // Handle different webhook event types
    switch (body.type) {
      case 'frame_authentication':
        return handleFrameAuthentication(body);
      case 'frame_interaction':
        return handleFrameInteraction(body);
      case 'frame_ready':
        return handleFrameReady(body);
      default:
        console.log('Unknown webhook type:', body.type);
        return NextResponse.json({ 
          success: true, 
          message: 'Webhook received' 
        });
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

/**
 * Handle frame authentication events
 */
async function handleFrameAuthentication(body: { data?: { user?: { fid?: string }; status?: string; error?: string } }): Promise<NextResponse> {
  try {
    const { user, status, error } = body.data || {};
    
    if (status === 'success' && user) {
      // Authentication successful
      console.log('Frame authentication successful for user:', user.fid);
      
      return NextResponse.json({
        success: true,
        message: 'Authentication successful',
        redirectUrl: '/' // Redirect to main app
      });
    }
    // Authentication failed
    console.error('Frame authentication failed:', error);
    
    return NextResponse.json({
      success: false,
      message: error || 'Authentication failed',
      redirectUrl: '/auth/error'
    });
  } catch (error) {
    console.error('Frame authentication handler error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Authentication handler error' 
    }, { status: 500 });
  }
}

/**
 * Handle general frame interactions
 */
async function handleFrameInteraction(body: { data?: { action?: string; user?: { fid?: string } } }): Promise<NextResponse> {
  try {
    const { action, user } = body.data || {};
    
    console.log('Frame interaction:', { action, userFid: user?.fid });
    
    // Handle different interaction types
    switch (action) {
      case 'sign_in_requested':
        return NextResponse.json({
          success: true,
          action: 'redirect',
          url: `/api/auth/signin/google?external=true&callbackUrl=${encodeURIComponent('/')}`
        });
      
      case 'app_opened':
        return NextResponse.json({
          success: true,
          message: 'App opened successfully'
        });
      
      default:
        return NextResponse.json({
          success: true,
          message: 'Interaction processed'
        });
    }
  } catch (error) {
    console.error('Frame interaction handler error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Interaction handler error' 
    }, { status: 500 });
  }
}

/**
 * Handle frame ready events
 */
async function handleFrameReady(body: { timestamp?: string }): Promise<NextResponse> {
  try {
    console.log('Frame ready event received');
    
    return NextResponse.json({
      success: true,
      message: 'Frame ready acknowledged',
      config: {
        features: ['oauth', 'external_links'],
        authEnabled: true,
        version: '1.0.0'
      }
    });
  } catch (error) {
    console.error('Frame ready handler error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Frame ready handler error' 
    }, { status: 500 });
  }
}

/**
 * Handle GET requests (health check)
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Farcaster webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}
