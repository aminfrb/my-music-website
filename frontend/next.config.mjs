/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Media (covers/avatars/audio) are served straight from the object store —
  // either as unsigned URLs off PUBLIC_MEDIA_URL or as presigned ones. We render
  // them with plain <img>/<audio> tags rather than next/image, so no
  // remotePatterns config is required for whichever host serves them.
};

export default nextConfig;
