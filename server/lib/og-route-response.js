const OG_IMAGE_CACHE_CONTROL = "public, max-age=300, stale-while-revalidate=86400";

export const sendOgText = (res, statusCode, body) =>
  res.status(statusCode).type("text/plain").send(body);

export const sendOgImageResponse = (res, rendered, deliveryHeaders = null) => {
  res.setHeader("Content-Type", rendered.contentType || "image/png");
  res.setHeader("Cache-Control", OG_IMAGE_CACHE_CONTROL);
  if (deliveryHeaders?.cache) {
    res.setHeader("X-OG-Cache", deliveryHeaders.cache);
  }
  if (deliveryHeaders?.serverTiming) {
    res.setHeader("Server-Timing", deliveryHeaders.serverTiming);
  }
  return res.status(200).send(Buffer.from(rendered.buffer));
};

export const handleOgImageRequest = async (
  res,
  { render, buildDeliveryHeaders, onRendered } = {},
) => {
  try {
    const rendered = await render?.();
    if (!rendered) {
      return sendOgText(res, 404, "not_found");
    }
    const deliveryHeaders =
      typeof buildDeliveryHeaders === "function" ? buildDeliveryHeaders(rendered) : null;
    if (typeof onRendered === "function") {
      onRendered(rendered);
    }
    return sendOgImageResponse(res, rendered, deliveryHeaders);
  } catch {
    return sendOgText(res, 500, "image_generation_failed");
  }
};
