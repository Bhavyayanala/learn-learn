import { AccessToken } from "livekit-server-sdk";

// Thin wrapper around livekit-server-sdk so the rest of the app never
// touches the SDK's token API directly. Room name convention: one
// persistent room per class ("class_<classId>") rather than one per
// session — simpler for Stage 11, at the cost of not auto-tying a live
// session to a specific class_sessions row for attendance (see README
// limitations). The room is created implicitly by LiveKit Cloud the
// first time someone joins it with roomJoin permission; nothing needs
// to pre-create it.

export function roomNameForClass(classId: string): string {
  return `class_${classId}`;
}

export async function createLiveKitToken(params: {
  roomName: string;
  identity: string;
  name: string;
  isTeacher: boolean;
}): Promise<string> {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error(
      "LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not configured on the server."
    );
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: params.identity,
    name: params.name,
    ttl: "2h",
  });

  at.addGrant({
    room: params.roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // Teachers get roomAdmin so a future moderation feature (e.g. mute
    // a student) has the grant it needs without reissuing tokens.
    // Nothing in this stage's UI uses it yet.
    roomAdmin: params.isTeacher,
  });

  return at.toJwt();
}
