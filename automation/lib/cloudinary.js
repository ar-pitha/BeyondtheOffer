// Signed uploads to Cloudinary over REST. Instagram needs public JPEG URLs.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const hasCloudinary = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

export const uploadImage = (filePath, opts) => upload(filePath, { ...opts, type: "image", mime: "image/jpeg" });

// Reels: Instagram fetches the MP4 from this public URL (video_url)
export const uploadVideo = (filePath, opts) => upload(filePath, { ...opts, type: "video", mime: "video/mp4" });

async function upload(filePath, { folder, publicId, type, mime }) {
  if (!hasCloudinary()) throw new Error("Cloudinary credentials missing (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)");

  const params = { folder, overwrite: "true", public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = crypto.createHash("sha1").update(toSign + process.env.CLOUDINARY_API_SECRET).digest("hex");

  const form = new FormData();
  for (const [k, v] of Object.entries(params)) form.append(k, String(v));
  form.append("api_key", process.env.CLOUDINARY_API_KEY);
  form.append("signature", signature);
  form.append("file", new Blob([fs.readFileSync(filePath)], { type: mime }), path.basename(filePath));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/${type}/upload`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Cloudinary upload failed: ${data.error?.message || res.status}`);
  return data.secure_url;
}

// Uploads every JPEG to beyondtheoffer/<CQ-ID>/ and returns the URLs in order.
export async function uploadSlides(files, cqId) {
  const urls = [];
  for (const file of files) {
    urls.push(await uploadImage(file, { folder: `beyondtheoffer/${cqId}`, publicId: path.basename(file, ".jpg") }));
  }
  return urls;
}
