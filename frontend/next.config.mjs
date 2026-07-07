/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Media (covers/avatars/audio) are served via short-lived presigned URLs from
  // S3/MinIO with query strings, so we render them with plain <img>/<audio> tags
  // rather than next/image — no remotePatterns config required.
};

export default nextConfig;
