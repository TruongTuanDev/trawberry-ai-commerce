from html import escape

from .base import ImageProvider, ProviderGenerateRequest, ProviderImageAsset


class MockImageProvider(ImageProvider):
    provider_name = "mock"

    async def generate(self, request: ProviderGenerateRequest) -> list[ProviderImageAsset]:
        title = escape(request.prompt[:140])
        mode = escape(request.mode)
        assets: list[ProviderImageAsset] = []

        for index in range(request.quantity):
            accent = ["#f6f2eb", "#eef4f7", "#f7f0ea", "#f1f4ec"][index % 4]
            svg = f"""
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="{accent}"/>
  <rect x="112" y="96" width="800" height="832" rx="48" fill="#ffffff" stroke="#d8cfbf" stroke-width="4"/>
  <circle cx="512" cy="320" r="118" fill="#dec8a7"/>
  <path d="M330 770c0-112 81-202 182-202s182 90 182 202" fill="#eadbc5"/>
  <rect x="250" y="150" width="524" height="560" rx="34" fill="none" stroke="#4c4032" stroke-width="6" stroke-dasharray="18 14"/>
  <text x="512" y="820" font-family="Arial, sans-serif" font-size="34" text-anchor="middle" fill="#2f261d">Mock AI Result {index + 1}</text>
  <text x="512" y="866" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#6f6252">{mode}</text>
  <foreignObject x="180" y="890" width="664" height="96">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 18px; color: #5b4d3f; text-align: center;">
      {title}
    </div>
  </foreignObject>
</svg>
""".strip().encode("utf-8")
            assets.append(
                ProviderImageAsset(
                    filename=f"{request.task_id}-mock-{index + 1}.svg",
                    content_type="image/svg+xml",
                    content=svg,
                    width=1024,
                    height=1024,
                    metadata={
                        "provider": self.provider_name,
                        "mode": request.mode,
                        "variant": index + 1,
                    },
                )
            )
        return assets
