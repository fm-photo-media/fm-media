import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { ALLOWED_IMAGE_TYPES, CLIENT_UPLOAD_PATHNAME, MAX_GALLERY_UPLOAD_BYTES } from "@/lib/upload";

// Token exchange for browser -> Blob uploads (files over SERVER_UPLOAD_BYTES, QA-6).
// Admin session required (checked against the AdminSession table on every call).
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Upload failed." }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // SEC-11: only names the admin form generates (gallery/<time>-<random>.<ext>).
        if (!CLIENT_UPLOAD_PATHNAME.test(pathname)) {
          throw new Error("Invalid upload destination.");
        }

        return {
          allowedContentTypes: [...ALLOWED_IMAGE_TYPES],
          maximumSizeInBytes: MAX_GALLERY_UPLOAD_BYTES,
          addRandomSuffix: false,
          cacheControlMaxAge: 60 * 60 * 24 * 365
        };
      }
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[gallery] client upload token refused", error);
    return NextResponse.json({ error: "Upload failed." }, { status: 400 });
  }
}
