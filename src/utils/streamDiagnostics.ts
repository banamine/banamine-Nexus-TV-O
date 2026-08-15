export interface DiagnosticResult {
  reason: 'CORS_BLOCKED' | 'MIXED_CONTENT' | 'GEO_BLOCKED' | 'DEAD_STREAM' | 'CODEC_ISSUE' | 'OK';
  title: string;
  description: string;
  solution: string;
}

export function diagnoseStreamError(url: string, errorDetail?: any): DiagnosticResult {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const streamIsHttp = typeof url === 'string' && url.startsWith('http://');

  if (isHttps && streamIsHttp) {
    return {
      reason: 'MIXED_CONTENT',
      title: 'Mixed Content Blocked (HTTP on HTTPS)',
      description: 'Your browser blocks unencrypted HTTP stream chunks when viewing an HTTPS application.',
      solution: 'Use the CORS Relay Proxy or open the stream in an external native player.',
    };
  }

  if (errorDetail?.response?.code === 403 || errorDetail?.response?.code === 401) {
    return {
      reason: 'GEO_BLOCKED',
      title: 'Geo-Blocked or Token Expired (403 / 401)',
      description: 'The broadcaster restricts streaming to specific regions or requires an active token.',
      solution: 'Use a localized VPN or request updated session tokens from the broadcaster.',
    };
  }

  if (errorDetail?.type === 'networkError' || errorDetail?.details === 'manifestLoadError') {
    return {
      reason: 'CORS_BLOCKED',
      title: 'CORS Header Missing or Server Offline',
      description: 'The broadcast server does not allow in-browser Web XHR requests.',
      solution: 'Toggle "CORS Relay Proxy" in player options to route segments through an open relay.',
    };
  }

  if (errorDetail?.details === 'bufferAppendError' || errorDetail?.details === 'bufferAddCodecError') {
    return {
      reason: 'CODEC_ISSUE',
      title: 'Unsupported Codec (MPEG-2 / AC-3 Audio)',
      description: 'Broadcast uses raw formats not decodable natively by browsers.',
      solution: 'Stream requires an H.264/AAC transcoder or playback in a native player.',
    };
  }

  return {
    reason: 'DEAD_STREAM',
    title: 'Stream Temporarily Offline',
    description: 'The source broadcast server is unreachable or rate-limited.',
    solution: 'The Watchdog circuit has engaged fallback. Select an alternate channel.',
  };
}
