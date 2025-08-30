import { NextRequest, NextResponse } from "next/server";
import { AuthService } from "@/services/AuthService";

// Slack webhook integration example
export async function POST(request: NextRequest) {
  try {
    const authService = AuthService.getInstance();
    
    // Validate API key for external integrations
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }
    
    // In a real implementation, validate the API key
    // const session = await authService.validateApiKey(apiKey);
    // if (!session) {
    //   return NextResponse.json(
    //     { error: 'Invalid API key' },
    //     { status: 401 }
    //   );
    // }
    
    const body = await request.json();
    
    // Verify Slack signature (for security)
    const slackSignature = request.headers.get('x-slack-signature');
    const slackTimestamp = request.headers.get('x-slack-request-timestamp');
    
    if (!verifySlackSignature(body, slackSignature, slackTimestamp)) {
      return NextResponse.json(
        { error: 'Invalid Slack signature' },
        { status: 401 }
      );
    }
    
    // Handle different Slack event types
    switch (body.type) {
      case 'url_verification':
        // Slack's URL verification challenge
        return NextResponse.json({ challenge: body.challenge });
        
      case 'event_callback':
        await handleSlackEvent(body.event);
        break;
        
      default:
        console.log('Unknown Slack event type:', body.type);
    }
    
    return NextResponse.json({ ok: true });
    
  } catch (error) {
    console.error('Slack integration error:', error);
    return NextResponse.json(
      { error: 'Integration handler failed' },
      { status: 500 }
    );
  }
}

function verifySlackSignature(
  body: any,
  signature: string | null,
  timestamp: string | null
): boolean {
  if (!signature || !timestamp) {
    return false;
  }
  
  // In a real implementation, verify the Slack signature
  // const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
  // const hmac = crypto.createHmac('sha256', slackSigningSecret);
  // const [version, hash] = signature.split('=');
  // const computedHash = hmac.update(`${version}:${timestamp}:${JSON.stringify(body)}`).digest('hex');
  // return hash === computedHash;
  
  return true; // For demo purposes
}

async function handleSlackEvent(event: any) {
  switch (event.type) {
    case 'message':
      await handleSlackMessage(event);
      break;
      
    case 'app_mention':
      await handleSlackMention(event);
      break;
      
    default:
      console.log('Unhandled Slack event:', event.type);
  }
}

async function handleSlackMessage(event: any) {
  console.log('Slack message received:', event.text);
  
  // Example: Process Slack messages for AI chatbot, notifications, etc.
}

async function handleSlackMention(event: any) {
  console.log('App mentioned in Slack:', event.text);
  
  // Example: Handle when your app is mentioned in Slack
}