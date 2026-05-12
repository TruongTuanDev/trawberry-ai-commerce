from app.schemas.ai_images import AiImageGenerateRequest


STYLE_HINTS = {
    "MAIN_COVER": "Use a clean white ecommerce background. Keep the product occupying roughly 70 percent of the frame with crisp commercial composition.",
    "STUDIO": "Use bright studio ecommerce lighting with soft balanced shadows and a clean professional set.",
    "LIFESTYLE": "Place the product in a subtle lifestyle environment while keeping the product fully readable and commercially clear.",
    "WALKING": "Use a natural walking pose with stable body alignment and clear product visibility.",
    "BACK_VIEW": "Prioritize the rear view and preserve all back-panel details accurately.",
    "DETAIL": "Focus tightly on material texture, pocket construction, waistband, zipper, stitching, and other authentic product details.",
    "TRY_ON": "Show a realistic try-on on a professional model while preserving the exact original garment appearance and fit characteristics as much as possible.",
}


class EcommercePromptBuilder:
    def build(self, payload: AiImageGenerateRequest) -> str:
        invariants = [
            "Keep the original product unchanged.",
            "Do not alter color, silhouette, fabric, stitching, logo placement, pockets, waistband, zipper, distressing, trims, hardware, or construction details.",
            "Do not invent new accessories, props, garments, text, numbers, labels, watermarks, or duplicate products.",
            "Keep the product as the visual center and the most important subject in the frame.",
            "Produce clean marketplace-ready ecommerce imagery suitable for catalog and Wildberries-style listing pages.",
        ]

        style_hint = STYLE_HINTS.get(
            payload.style_preset or "",
            "Create a clean marketplace-safe ecommerce image with faithful product preservation.",
        )

        reference_usage = []
        if payload.input_images.front_image_url:
            reference_usage.append("Use the front product image as the primary source of truth for silhouette, color, and visible construction.")
        if payload.input_images.back_image_url:
            reference_usage.append("Use the back product image to preserve rear construction and back-side details.")
        if payload.input_images.model_image_url:
            reference_usage.append("Use the model reference only for pose, body proportions, and styling mood, not for changing the product.")

        sections = [
            f"Task type: {payload.task_type}",
            f"Style preset: {payload.style_preset or 'NONE'}",
            f"Base prompt: {payload.prompt}",
            f"Style guidance: {style_hint}",
            "Non-negotiable rules:",
            *[f"- {rule}" for rule in invariants],
        ]

        if reference_usage:
            sections.append("Reference handling:")
            sections.extend(f"- {item}" for item in reference_usage)

        return "\n".join(sections)
